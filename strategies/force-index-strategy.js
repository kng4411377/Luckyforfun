
/**
 * Force Index Strategy
 *
 * Elder's Force Index = direction * distance * volume.
 * Use smoothed FI to detect pullbacks within a trend.
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';

function ema(arr, len) { return TI.ema(arr, len); }

export class ForceIndexStrategy extends BaseStrategy {
  constructor(config) {
    super('force-index', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Elder Force Index pullback entries in trending markets',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['EMA','ATR']
    };
  }

  async initialize() {
    this.config = {
      emaLenTrend: 22,  // trend EMA for closes
      fiLen: 2,         // raw FI smoothing
      fiSignal: 13,     // signal smoothing
      atrLen: 14,
      riskPerTradeUSD: 1000,
      ...this.config
    };
    return true;
  }

  _forceIndex(closes, volumes) {
    const fi = [];
    for (let i=1;i<closes.length;i++) {
      const val = (closes[i] - closes[i-1]) * (volumes[i] ?? 0);
      fi.push(val);
    }
    const sm = ema(fi, this.config.fiLen);
    const sig = ema(sm, this.config.fiSignal);
    return { sm, sig };
  }

  analyze(symbol, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 300 }) || this.getPriceHistory(symbol);
    if (!d || d.length < 60) return { signal: 'HOLD', strength: 0, reason: 'Insufficient history' };
    const closes = d.map(b => b.price);
    const volumes= d.map(b => b.volume ?? 0);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);

    const emaTrend = TI.ema(closes, this.config.emaLenTrend);
    const trendUp  = closes[closes.length-1] > emaTrend[emaTrend.length-1];
    const trendDown= closes[closes.length-1] < emaTrend[emaTrend.length-1];

    const { sm, sig } = this._forceIndex(closes, volumes);
    const fi = sm[sm.length-1];
    const fiSig = sig[sig.length-1];

    if (trendUp && fi < 0 && fiSig < 0) {
      return { signal: 'BUY', strength: 50, reasons: ['Uptrend above EMA','FI below 0 (pullback) rising towards signal'], fi, fiSig };
    }
    if (trendDown && fi > 0 && fiSig > 0) {
      return { signal: 'SELL', strength: 50, reasons: ['Downtrend below EMA','FI above 0 (rally) turning down'], fi, fiSig };
    }
    return { signal: 'HOLD', strength: 0, reasons: ['No FI setup'], fi, fiSig };
  }

  calculatePositionSize(symbol, price, accountValue) {
    const riskUSD = this.config.riskPerTradeUSD || 1000;
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (price * 0.02);
    const qty = Math.floor(riskUSD / Math.max(1e-6, atr));
    return Math.max(0, qty);
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low ?? b.price);
    const atr = TI.atr(highs, lows, closes, this.config.atrLen) || (entryPrice * 0.02);
    if (positionSide === 'long') return { stopLoss: entryPrice - 2*atr, takeProfit: entryPrice + 4*atr };
    else return { stopLoss: entryPrice + 2*atr, takeProfit: entryPrice - 4*atr };
  }
}
