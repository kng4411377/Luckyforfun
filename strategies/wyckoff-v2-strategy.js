
/**
 * Wyckoff V2 Strategy (range → spring → SOS → markup)
 * Simplified state machine matching your BaseStrategy interface.
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TradingLogger } from '../src/logger.js';

function rollingMax(arr, lookback) {
  if (arr.length < lookback) return null;
  return Math.max(...arr.slice(-lookback));
}
function rollingMin(arr, lookback) {
  if (arr.length < lookback) return null;
  return Math.min(...arr.slice(-lookback));
}

export class WyckoffV2Strategy extends BaseStrategy {
  constructor(config) {
    super('wyckoff-v2', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Wyckoff: detect range, spring, SOS, then trend',
      timeframe: '30m',
      riskLevel: 'medium',
      requiredIndicators: []
    };
    this.state = new Map(); // per-symbol FSM
  }

  async initialize() {
    this.config = {
      lookback: 50,
      flatTol: 0.03, // tolerance for flat bounds
      riskManagement: this.config?.riskManagement || {
        maxPositionSize: 25000,
        stopLossPercent: 0.02,
        takeProfitPercent: 0.05
      },
      ...this.config
    };
    TradingLogger.logStrategy('Wyckoff V2 initialized', this.config);
    return true;
  }

  getMaxHistoryLength() { return this.config.lookback + 10; }

  analyze(symbol, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist || hist.length < this.getMaxHistoryLength()) {
      return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };
    }
    const highs = hist.map(h => h.high ?? h.price);
    const lows  = hist.map(h => h.low  ?? h.price);
    const closes= hist.map(h => h.price);
    const iHi = rollingMax(highs, this.config.lookback);
    const iLo = rollingMin(lows,  this.config.lookback);
    if (iHi == null || iLo == null) return { signal: 'HOLD', strength: 0 };

    const last = closes[closes.length - 1];
    const lastLow = lows[lows.length - 1];

    let fsm = this.state.get(symbol) || { phase:'none', rangeHi:null, rangeLo:null, inPos:false };
    const width = (iHi - iLo) / Math.max(1e-9, last);

    // Detect range
    if (width < this.config.flatTol && fsm.phase === 'none') {
      fsm.phase = 'range'; fsm.rangeHi = iHi; fsm.rangeLo = iLo;
    }

    if (fsm.phase === 'range') {
      const spring = lastLow < fsm.rangeLo && last > fsm.rangeLo;
      if (spring) fsm.phase = 'accum';
    }

    if (fsm.phase === 'accum') {
      const sos = last > fsm.rangeHi;
      if (sos) { this.state.set(symbol, { ...fsm, phase:'markup' }); return { signal: 'BUY', strength: 70, reasons:['SOS breakout above range'] }; }
    }

    this.state.set(symbol, fsm);
    return { signal: 'HOLD', strength: 0, reasons: ['No trigger'] };
  }

  calculatePositionSize(symbol, price, accountValue) {
    const maxVal = Math.min(this.config.riskManagement.maxPositionSize, accountValue * 0.2);
    return Math.max(1, Math.floor(maxVal / price));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const slPct = this.config.riskManagement.stopLossPercent ?? 0.02;
    const tpPct = this.config.riskManagement.takeProfitPercent ?? 0.05;
    if (positionSide === 'long') {
      return { stopLoss: entryPrice * (1 - slPct), takeProfit: entryPrice * (1 + tpPct) };
    } else {
      return { stopLoss: entryPrice * (1 + slPct), takeProfit: entryPrice * (1 - tpPct) };
    }
  }

  checkExitSignal(symbol, position, marketData) {
    const hist = this.getPriceHistory(symbol) || [];
    if (!hist.length) return { signal: 'HOLD', reason: 'No data' };
    const last = hist[hist.length - 1].price;
    const fsm = this.state.get(symbol) || {};
    if (position.side === 'long' && fsm.rangeHi && last < fsm.rangeHi) {
      return { signal: 'EXIT', reason: 'Close fell back into range' };
    }
    return { signal: 'HOLD', reason: 'No exit' };
  }
}
