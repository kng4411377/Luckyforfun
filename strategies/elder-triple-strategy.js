
/**
 * Elder Triple Screen Strategy (simplified)
 * - Higher-timeframe trend filter via EMA slope
 * - Lower-timeframe entry via RSI(2) pullback
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';
import { TradingLogger } from '../src/logger.js';

export class ElderTripleScreenStrategy extends BaseStrategy {
  constructor(config) {
    super('elder-triple', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Elder Triple Screen: EMA trend + RSI(2) pullback',
      timeframe: '5m',
      riskLevel: 'medium',
      requiredIndicators: ['EMA', 'RSI']
    };
  }

  async initialize() {
    try {
      this.config = {
        emaPeriod: 65,
        rsiPeriod: 2,
        rsiBuy: 15,
        rsiSell: 85,
        riskManagement: this.config?.riskManagement || {
          maxPositionSize: 25000,
          stopLossPercent: 0.02,
          takeProfitPercent: 0.04
        },
        ...this.config
      };
      TradingLogger.logStrategy('Elder Triple Screen initialized', this.config);
      return true;
    } catch (e) {
      TradingLogger.logError(e, 'elder-triple:initialize');
      return false;
    }
  }

  getMaxHistoryLength() {
    return Math.max(this.config.emaPeriod + 5, this.config.rsiPeriod + 5);
  }

  analyze(symbol, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist || hist.length < this.getMaxHistoryLength()) {
      return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };
    }
    const prices = hist.map(h => h.price);
    const ema = TI.ema(prices, this.config.emaPeriod);
    const emaPrev = TI.ema(prices.slice(0, -1), this.config.emaPeriod);
    if (ema == null || emaPrev == null) return { signal: 'HOLD', strength: 0, reason: 'No EMA yet' };
    const slope = ema - emaPrev;
    const trend = slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat';
    const rsi2 = TI.rsi(prices, this.config.rsiPeriod) ?? 50;

    let signal = 'HOLD', strength = 0; const reasons = [];
    if (trend === 'up' && rsi2 <= this.config.rsiBuy) {
      signal = 'BUY'; strength = 60; reasons.push(`Uptrend + RSI(${this.config.rsiPeriod})=${rsi2.toFixed(2)}<=${this.config.rsiBuy}`);
    } else if (trend === 'down' && rsi2 >= this.config.rsiSell) {
      signal = 'SELL'; strength = 60; reasons.push(`Downtrend + RSI(${this.config.rsiPeriod})=${rsi2.toFixed(2)}>=${this.config.rsiSell}`);
    } else {
      reasons.push(`Trend=${trend}, RSI=${rsi2.toFixed(2)}`);
    }

    return { signal, strength, reasons };
  }

  calculatePositionSize(symbol, price, accountValue) {
    const maxVal = Math.min(this.config.riskManagement.maxPositionSize, accountValue * 0.2);
    return Math.max(1, Math.floor(maxVal / price));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const slPct = this.config.riskManagement.stopLossPercent ?? 0.02;
    const tpPct = this.config.riskManagement.takeProfitPercent ?? 0.04;
    if (positionSide === 'long') {
      return { stopLoss: entryPrice * (1 - slPct), takeProfit: entryPrice * (1 + tpPct) };
    } else {
      return { stopLoss: entryPrice * (1 + slPct), takeProfit: entryPrice * (1 - tpPct) };
    }
  }

  checkExitSignal(symbol, position, marketData) {
    // Use base class helper for SL/TP if present
    const current = marketData.lastPrice;
    const standard = this.checkStandardExits?.(position, current);
    if (standard && standard.signal !== 'HOLD') return standard;
    // Elder-style mean reversion completion: RSI crosses midline
    const hist = this.getPriceHistory(symbol);
    if (!hist?.length) return { signal: 'HOLD', reason: 'No history' };
    const rsi2 = TI.rsi(hist.map(h => h.price), this.config.rsiPeriod) ?? 50;
    if (position.side === 'long' && rsi2 >= 50) return { signal: 'EXIT', reason: 'RSI crossed up to 50' };
    if (position.side === 'short' && rsi2 <= 50) return { signal: 'EXIT', reason: 'RSI crossed down to 50' };
    return { signal: 'HOLD', reason: 'No exit' };
  }
}
