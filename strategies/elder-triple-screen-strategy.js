
/**
 * Elder Triple Screen Strategy
 * 
 * Implements Alexander Elder's Triple Screen Trading System:
 *   1) Higher timeframe trend filter (weekly) via MACD-Histogram slope.
 *   2) Entry on lower timeframe countertrend waves using oscillators (daily).
 *   3) Place protective stops using ATR; pyramid with trailing channel.
 *
 * Your engine must provide multi-timeframe history through BaseStrategy:
 *   - getPriceHistory(symbol, { timeframe: '1w' | '1d', lookback: N })
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';

export class ElderTripleScreenStrategy extends BaseStrategy {
  constructor(config) {
    super('elder-triple-screen', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Triple Screen: weekly MACD-H slope + daily oscillator pullback',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['EMA','MACD','ATR']
    };
  }

  async initialize() {
    this.config = {
      // Weekly trend definition via MACD-H slope
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      weeklyLookback: 120, // ~ 2+ years
      // Daily entry oscillator and thresholds
      dailyTimeframe: '1d',
      weeklyTimeframe: '1w',
      rsiLen: 2,                 // Elder often used short oscillators for pullbacks
      rsiBuy: 25,                // buy pullbacks in uptrend when RSI2 < 25
      rsiSell: 75,               // sell rallies in downtrend when RSI2 > 75
      // Risk
      atrLen: 14,
      stopATR: 2.0,              // initial stop = 2*ATR
      trailATR: 3.0,             // optional trailing stop multiple
      riskPerTradeUSD: 1000,
      maxPositionSizeUSD: 25000,
      ...this.config
    };
    return true;
  }

  /** Detect weekly trend using MACD-H slope */
  _weeklyBias(symbol) {
    const w = this.getPriceHistory(symbol, { timeframe: this.config.weeklyTimeframe, lookback: this.config.weeklyLookback });
    if (!w || w.length < 60) return null;
    const closes = w.map(b => b.price);
    const macd = TI.macd(closes, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
    const hist = macd.histogram;
    if (!hist || hist.length < 5) return null;
    const slope = hist[hist.length-1] - hist[hist.length-5];
    return slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'FLAT';
  }

  analyze(symbol, marketData) {
    // 1) Weekly bias
    const bias = this._weeklyBias(symbol);
    if (!bias) return { signal: 'HOLD', strength: 0, reason: 'No weekly bias' };

    // 2) Daily oscillator
    const d = this.getPriceHistory(symbol, { timeframe: this.config.dailyTimeframe, lookback: 300 }) || this.getPriceHistory(symbol);
    if (!d || d.length < 50) return { signal: 'HOLD', strength: 0, reason: 'Insufficient daily history' };
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low  ?? b.price);
    const rsi2 = TI.rsi(closes, this.config.rsiLen);
    const rsi = rsi2[rsi2.length-1];

    const atr = TI.atr(highs, lows, closes, this.config.atrLen);
    const last = closes[closes.length-1];

    if (bias === 'UP' && rsi <= this.config.rsiBuy) {
      return { signal: 'BUY', strength: 60, reasons: ['Weekly uptrend (MACD‑H rising)','Daily pullback (RSI2 low)'], bias, rsi, atr, intent: 'INIT' };
    }
    if (bias === 'DOWN' && rsi >= this.config.rsiSell) {
      return { signal: 'SELL', strength: 60, reasons: ['Weekly downtrend (MACD‑H falling)','Daily rally (RSI2 high)'], bias, rsi, atr, intent: 'INIT' };
    }
    return { signal: 'HOLD', strength: 0, reasons: ['No pullback vs bias'], bias, rsi };
  }

  calculatePositionSize(symbol, price, accountValue, analyzeResult) {
    const riskUSD = this.config.riskPerTradeUSD || 1000;
    const capUSD  = Math.min(this.config.maxPositionSizeUSD || accountValue * 0.2, accountValue * 0.2);
    // Risk per share using ATR stop
    const d = this.getPriceHistory(symbol, { timeframe: this.config.dailyTimeframe, lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (price * 0.02);
    const riskPerShare = this.config.stopATR * atr;
    const qty = Math.floor(riskUSD / Math.max(1e-6, riskPerShare));
    return Math.max(0, Math.min(qty, Math.floor(capUSD / Math.max(1e-6, price))));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const d = this.getPriceHistory(symbol, { timeframe: this.config.dailyTimeframe, lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (entryPrice * 0.02);
    const mult = this.config.stopATR;
    const trail = this.config.trailATR;
    if (positionSide === 'long') {
      return { stopLoss: entryPrice - mult * atr, trailing: trail ? (entryPrice - trail * atr) : null };
    } else {
      return { stopLoss: entryPrice + mult * atr, trailing: trail ? (entryPrice + trail * atr) : null };
    }
  }
}
