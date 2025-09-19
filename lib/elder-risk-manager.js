
/**
 * Elder Risk & Money Management Helper
 *
 * Implements popular risk rules attributed to Elder:
 *   - Risk per trade (e.g., 2% of equity, or fixed USD)
 *   - Risk cap per month (e.g., 6% account drawdown cap)
 *   - Equity curve circuit breaker to pause after N consecutive losses
 */
export class ElderRiskManager {
  constructor(config={}) {
    this.config = Object.assign({
      riskPctPerTrade: 0.02,    // 2% of equity
      maxMonthlyDrawdownPct: 0.06,
      pauseAfterConsecutiveLosses: 3,
      cooldownDays: 3
    }, config);
    this.state = { equityHighMonth: null, consecutiveLosses: 0, pausedUntil: null };
  }

  ticketSize(accountValue, stopDistance) {
    const riskUSD = Math.min(accountValue * this.config.riskPctPerTrade, this.config.maxRiskUSD || Infinity);
        // shares = riskUSD / stopDistance
    return Math.max(0, Math.floor(riskUSD / Math.max(1e-6, stopDistance)));
  }

  onTradeClosed({ pnlUSD, date }) {
    if (pnlUSD < 0) this.state.consecutiveLosses += 1;
    else this.state.consecutiveLosses = 0;
    if (this.state.consecutiveLosses >= this.config.pauseAfterConsecutiveLosses) {
      const dt = new Date(date); dt.setDate(dt.getDate() + this.config.cooldownDays);
      this.state.pausedUntil = dt;
    }
  }

  canTrade({ accountValue, monthStartEquity, today }) {
    const now = new Date(today);
    if (this.state.pausedUntil && now < this.state.pausedUntil) return { ok:false, reason:'Cooling down after losses' };
    const dd = (monthStartEquity - accountValue) / Math.max(1e-6, monthStartEquity);
    if (dd >= this.config.maxMonthlyDrawdownPct) return { ok:false, reason:'Monthly drawdown cap reached' };
    return { ok:true };
  }
}
