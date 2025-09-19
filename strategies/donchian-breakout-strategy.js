
/**
 * Donchian Channel Breakout Strategy (Turtle-style variant)
 *
 * Inspired by classic trend-followers highlighted across the Market Wizards series:
 *  - Breakouts after N-day highs/lows (Donchian channel)
 *  - Use ATR for position sizing and stops ("N" volatility unit)
 *  - Optional breakout confirmation: close above/below band
 *  - Pyramiding on further volatility units in profit
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';

export class DonchianBreakoutStrategy extends BaseStrategy {
  constructor(config) {
    super('donchian-breakout', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Donchian/Turtle-style trend breakout with ATR sizing',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['ATR']
    };
    this.positions = new Map(); // to track pyramid levels per symbol
  }

  async initialize() {
    this.config = {
      channelLenEntry: 55,     // classic: 55 days
      channelLenExit: 20,      // classic: 20 days for exits
      atrLen: 20,              // N = ATR(20)
      riskPerUnitUSD: 1000,    // risk per 1*N
      unitsMax: 4,             // pyramiding units
      confirmClose: true,      // require close beyond band
      allowShort: true,
      ...this.config
    };
    return true;
  }

  _bands(highs, lows) {
    const len = highs.length;
    const n = this.config.channelLenEntry;
    const hi = Math.max(...highs.slice(len-n, len));
    const lo = Math.min(...lows.slice(len-n, len));
    return { hi, lo };
  }

  analyze(symbol, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: Math.max(300, this.config.channelLenEntry + 5) }) || this.getPriceHistory(symbol);
    if (!d || d.length < this.config.channelLenEntry + 5) return { signal: 'HOLD', strength: 0, reason: 'Insufficient history' };

    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low  ?? b.price);
    const { hi, lo } = this._bands(highs, lows);

    const atr = TI.atr(highs, lows, closes, this.config.atrLen);
    const N = atr || (closes[closes.length-1] * 0.02);
    const lastClose = closes[closes.length-1];
    const lastHigh = highs[highs.length-1];
    const lastLow  = lows[lows.length-1];

    // Entry signals
    const longBreak  = this.config.confirmClose ? (lastClose > hi) : (lastHigh > hi);
    const shortBreak = this.config.confirmClose ? (lastClose < lo) : (lastLow  < lo);

    const pos = this.positions.get(symbol) || { units: 0, entryPrice: null, side: null };

    if (longBreak && (!pos.side || pos.side === 'short')) {
      return { signal: 'BUY', strength: 65, reasons: [`Breakout > ${this.config.channelLenEntry}‑day high`], N, band: hi };
    }
    if (this.config.allowShort && shortBreak && (!pos.side || pos.side === 'long')) {
      return { signal: 'SELL', strength: 65, reasons: [`Breakout < ${this.config.channelLenEntry}‑day low`], N, band: lo };
    }
    return { signal: 'HOLD', strength: 0, reasons: ['No breakout'], N };
  }

  calculatePositionSize(symbol, price, accountValue, analyzeResult) {
    const N = analyzeResult?.N || (price * 0.02);
    const unit = Math.max(1, Math.floor((this.config.riskPerUnitUSD || 1000) / Math.max(1e-6, N)));
    // First entry = 1 unit; pyramids handled by external position manager using checkAddUnit
    return unit;
  }

  calculateStops(symbol, entryPrice, positionSide, analyzeResult) {
    const N = analyzeResult?.N || (entryPrice * 0.02);
    const sl = positionSide === 'long' ? entryPrice - 2*N : entryPrice + 2*N; // classic 2N initial stop
    return { stopLoss: sl, takeProfit: null };
  }

  /** Optional helper for pyramiding: add one more unit for each +0.5N move in favor */
  checkPyramid(symbol, position, marketData) {
    if (!position) return { add: 0 };
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 100 });
    const closes = d.map(b => b.price);
    const highs  = d.map(b => b.high ?? b.price);
    const lows   = d.map(b => b.low  ?? b.price);
    const N = TI.atr(highs, lows, closes, this.config.atrLen) || (closes[closes.length-1] * 0.02);

    const move = (closes[closes.length-1] - position.avgEntry) * (position.side === 'long' ? 1 : -1);
    const steps = Math.floor(move / (0.5 * N));
    const canAdd = Math.max(0, Math.min(steps, this.config.unitsMax - (position.units || 1)));
    return { add: canAdd };
  }

  checkExitSignal(symbol, position, marketData) {
    if (!position) return { signal: 'HOLD', reason: 'No position' };
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: Math.max(100, this.config.channelLenExit + 5) });
    const highs = d.map(b => b.high ?? b.price);
    const lows  = d.map(b => b.low  ?? b.price);
    const len = highs.length;
    const n = this.config.channelLenExit;
    const exitHi = Math.max(...highs.slice(len-n, len));
    const exitLo = Math.min(...lows.slice(len-n, len));

    if (position.side === 'long' && (lows[lows.length-1] < exitLo)) return { signal: 'EXIT', reason: `Exit: ${n}-day low` };
    if (position.side === 'short' && (highs[highs.length-1] > exitHi)) return { signal: 'EXIT', reason: `Exit: ${n}-day high` };
    return { signal: 'HOLD', reason: 'Trend intact' };
  }
}
