
/**
 * RSI(2) Mean Reversion Strategy (daily)
 *
 * A simple, robust mean-reversion approach often echoed by short-term equities traders:
 *  - Universe: liquid large/mid caps (apply your own filters)
 *  - Entry long when RSI2 <= buyLevel while above 200SMA (trade pullbacks in uptrends)
 *  - Exit on rebound to SMA20 or RSI2 > sellLevel
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';

export class RSI2MeanReversionStrategy extends BaseStrategy {
  constructor(config) {
    super('rsi2-mean-reversion', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'RSI(2) pullback buys in uptrends; symmetric shorts optional',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['SMA','RSI','ATR']
    };
  }

  async initialize() {
    this.config = {
      baseSMA: 200,
      fastSMA: 20,
      rsiLen: 2,
      buyLevel: 10,
      sellLevel: 80,
      riskPerTradeUSD: 1000,
      allowShort: false,
      atrLen: 14,
      ...this.config
    };
    return true;
  }

  analyze(symbol, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 300 }) || this.getPriceHistory(symbol);
    if (!d || d.length < this.config.baseSMA + 5) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low  ?? b.price);

    const sma200 = TI.sma(closes, this.config.baseSMA);
    const sma20  = TI.sma(closes, this.config.fastSMA);
    const rsiArr = TI.rsi(closes, this.config.rsiLen);
    const last = closes[closes.length-1];
    const rsi = rsiArr[rsiArr.length-1];

    const uptrend = last > sma200;
    const downtrend = last < sma200;

    if (uptrend && rsi <= this.config.buyLevel) {
      return { signal: 'BUY', strength: 55, reasons: ['Uptrend above 200SMA','RSI2 deeply oversold'], rsi, sma20: sma20 };
    }
    if (this.config.allowShort && downtrend && rsi >= 100 - this.config.buyLevel) {
      return { signal: 'SELL', strength: 55, reasons: ['Downtrend below 200SMA','RSI2 overbought'], rsi, sma20: sma20 };
    }
    return { signal: 'HOLD', strength: 0, reasons: ['No setup'], rsi };
  }

  calculatePositionSize(symbol, price, accountValue) {
    const riskUSD = this.config.riskPerTradeUSD || 1000;
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (price * 0.02);
    const qty = Math.floor(riskUSD / Math.max(1e-6, 1.5 * atr)); // 1.5*ATR stop distance approx
    return Math.max(0, qty);
  }

  calculateStops(symbol, entryPrice, positionSide, analyzeResult) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (entryPrice * 0.02);
    if (positionSide === 'long') {
      return { stopLoss: entryPrice - 1.5*atr, takeProfit: null, exitOn: 'close >= SMA20 or RSI2 > 80' };
    } else {
      return { stopLoss: entryPrice + 1.5*atr, takeProfit: null, exitOn: 'close <= SMA20 or RSI2 < 20' };
    }
  }

  checkExitSignal(symbol, position, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 250 });
    const closes = d.map(b => b.price);
    const rsi = TI.rsi(closes, this.config.rsiLen).pop();
    const sma20 = TI.sma(closes, this.config.fastSMA);
    const last = closes[closes.length-1];
    if (position.side === 'long' && (last >= sma20 || rsi >= this.config.sellLevel)) return { signal: 'EXIT', reason: 'Reverted to mean' };
    if (position.side === 'short' && (last <= sma20 || rsi <= (100 - this.config.sellLevel))) return { signal: 'EXIT', reason: 'Reverted to mean' };
    return { signal: 'HOLD', reason: 'No exit' };
  }
}
