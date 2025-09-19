
/**
 * Volatility-Targeted Trend Strategy
 *
 * Core ideas seen among several systematic macro/equity traders:
 *  - Use a trend filter (SMA cross or breakout)
 *  - Set position size to target annualized volatility (e.g., 15%)
 *  - Rebalance sizing as realized vol changes
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';

function annualizedVol(returns, periodsPerYear=252) {
  if (!returns || returns.length < 20) return null;
  const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
  const varr = returns.reduce((a,b)=>a + Math.pow(b-mean,2),0) / (returns.length-1);
  return Math.sqrt(varr * periodsPerYear);
}

export class VolTargetTrendStrategy extends BaseStrategy {
  constructor(config) {
    super('voltarget-trend', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Trend-following with volatility targeting',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['SMA']
    };
  }

  async initialize() {
    this.config = {
      fast: 50,
      slow: 200,
      volLookback: 20,
      targetVol: 0.15,  // 15% annualized
      maxLeverage: 2.0,
      ...this.config
    };
    return true;
  }

  analyze(symbol, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 400 }) || this.getPriceHistory(symbol);
    if (!d || d.length < this.config.slow + 5) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };
    const closes = d.map(b => b.price);
    const fast = TI.sma(closes, this.config.fast);
    const slow = TI.sma(closes, this.config.slow);

    const longBias = fast > slow;
    const returns = [];
    for (let i=1;i<closes.length;i++) returns.push((closes[i]-closes[i-1])/closes[i-1]);
    const rv = annualizedVol(returns.slice(-this.config.volLookback*2)) || 0.20;

    if (longBias) return { signal: 'BUY', strength: 50, reasons: ['Fast > Slow'], realizedVol: rv };
    else return { signal: 'SELL', strength: 50, reasons: ['Fast < Slow'], realizedVol: rv };
  }

  calculatePositionSize(symbol, price, accountValue, analyzeResult) {
    const rv = analyzeResult?.realizedVol || 0.20;
    const target = this.config.targetVol;
    const leverage = Math.min(this.config.maxLeverage, Math.max(0.0, target / Math.max(1e-6, rv)));
    // Convert leverage into quantity in your engine elsewhere; here we return a "notional" fraction of equity to deploy
    return Math.floor((accountValue * leverage) / Math.max(1e-6, price));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    // Can be managed by cross exit only; optional volatility stop
    return { stopLoss: null, takeProfit: null };
  }

  checkExitSignal(symbol, position, marketData) {
    const d = this.getPriceHistory(symbol, { timeframe: '1d', lookback: 250 });
    const closes = d.map(b => b.price);
    const fast = TI.sma(closes, this.config.fast);
    const slow = TI.sma(closes, this.config.slow);
    if (position.side === 'long' && fast < slow) return { signal: 'EXIT', reason: 'Fast < Slow' };
    if (position.side === 'short' && fast > slow) return { signal: 'EXIT', reason: 'Fast > Slow' };
    return { signal: 'HOLD', reason: 'Trend intact' };
  }
}
