
/**
 * Kelly-style Sizer (capped)
 *
 * Computes fraction f* = edge/variance from a stream of trades or a model of winrate & payoff ratio.
 * Caps to avoid overbetting and estimation error.
 */
export class KellySizer {
  constructor(config={}) {
    this.config = Object.assign({
      maxFraction: 0.2,     // cap at 20% of equity
      halfKelly: true
    }, config);
  }

  fromStats({ winRate, avgWin, avgLoss }) {
    // Using simplified Kelly for discrete outcomes
    const b = avgWin / Math.max(1e-6, Math.abs(avgLoss));
    const p = winRate;
    const q = 1 - p;
    const f = (b*p - q) / b;
    const fk = this.config.halfKelly ? f/2 : f;
    return Math.max(0, Math.min(this.config.maxFraction, fk));
  }
}
