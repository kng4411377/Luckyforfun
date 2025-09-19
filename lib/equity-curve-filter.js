
/**
 * Equity Curve Filter
 *
 * Apply a regime filter based on your own strategy's equity curve:
 *  - Trade only when strategy's smoothed equity is above its MA
 *  - Pause after drawdowns exceed a threshold
 */
export class EquityCurveFilter {
  constructor(config={}) {
    this.config = Object.assign({ maLen: 50, ddPausePct: 0.1 }, config);
  }

  shouldTrade({ equityHistory }) {
    if (!equityHistory || equityHistory.length < this.config.maLen + 5) return true;
    const last = equityHistory[equityHistory.length-1];
    const ma = equityHistory.slice(-this.config.maLen).reduce((a,b)=>a+b,0) / this.config.maLen;
    const equityHigh = Math.max(...equityHistory);
    const drawdown = (equityHigh - last) / Math.max(1e-6, equityHigh);
    if (last < ma) return false;
    if (drawdown >= this.config.ddPausePct) return false;
    return true;
  }
}
