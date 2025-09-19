
/**
 * Random Walk (Malkiel) Passive Strategy
 * - Implements buy-and-hold indexing with periodic rebalancing and DCA (dollar-cost averaging).
 * - Designed to be instantiated per symbol, with a target weight in a multi-asset portfolio.
 *
 * Key ideas from Malkiel:
 *   • Markets are hard to beat → prefer low-cost broad index funds.
 *   • Diversify across asset classes; hold for long horizons.
 *   • Rebalance periodically or when allocations drift beyond bands.
 *   • Dollar-cost average new contributions on a fixed cadence.
 *
 * Assumptions:
 * - Your app maintains total account value (equity) and per-symbol position.
 * - StrategyManager will call `analyze(symbol, marketData)` per symbol.
 * - Orders are MARKET orders sized by `calculatePositionSize` (passive sizing here).
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TradingLogger } from '../src/logger.js';

export class RandomWalkPassiveStrategy extends BaseStrategy {
  constructor(config) {
    super('random-walk-passive', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Buy‑and‑hold indexing with DCA + periodic band rebalancing',
      timeframe: '1d',
      riskLevel: 'low',
      requiredIndicators: []
    };
    this.state = new Map(); // per-symbol tracking
  }

  async initialize() {
    // Defaults fit a common "lazy portfolio" approach
    this.config = {
      // Target allocation of this symbol within the portfolio, e.g. 0.6 for equity index, 0.4 for bonds.
      targetWeight: 0.6,
      // Rebalance when weight drifts outside this band (e.g., ±5% absolute weight).
      rebalanceBand: 0.05,
      // Minimum days between rebalances to avoid churn.
      minRebalanceDays: 30,
      // Calendar rebalancing cadence (days). If null, band-only rebalancing.
      rebalanceEveryDays: 90,
      // DCA: fixed USD to invest on schedule; set 0 to disable.
      dcaContributionUSD: 0,
      // DCA cadence in days (e.g., 14 for biweekly, 30 for monthly).
      dcaEveryDays: 30,
      // Optional glide path (age-based): if set, override targetWeight per assetClass.
      // Provide: { enabled:true, age: 40, assetClass:'equity'|'bond', formula:'110-minus-age' }
      glidePath: { enabled: false },
      // Risk/ops limits
      riskManagement: this.config?.riskManagement || {
        maxPositionSize: 1000000, // effectively unlimited for passive
        allowShort: false
      },
      ...this.config
    };
    TradingLogger.logStrategy('Random Walk Passive initialized', this.config);
    return true;
  }

  getMaxHistoryLength() { return 5; }

  /** Compute dynamic target weight if glide path is enabled */
  _computeTargetWeight() {
    const gp = this.config.glidePath;
    if (!gp?.enabled) return this.config.targetWeight;
    const age = gp.age ?? 40;
    // Simple rule: equity% = max(0, min(1, (110 - age)/100))
    let equityFrac = Math.max(0, Math.min(1, (110 - age) / 100));
    if (gp.formula === '120-minus-age') equityFrac = Math.max(0, Math.min(1, (120 - age) / 100));
    if (gp.assetClass === 'equity') return equityFrac;
    if (gp.assetClass === 'bond')   return 1 - equityFrac;
    return this.config.targetWeight;
  }

  /** Returns portfolio weight of this symbol given accountValue and position (if available). */
  _currentWeight(symbol, accountValue, marketData) {
    const price = marketData?.lastPrice;
    const position = this.getPosition?.(symbol); // expect BaseStrategy to provide or StrategyManager to inject
    const value = position ? (position.quantity || 0) * price : 0;
    if (!accountValue || accountValue <= 0) return 0;
    return value / accountValue;
  }

  /** Track last actions per symbol (rebalance/DCA timestamps) */
  _ensureState(symbol) {
    if (!this.state.has(symbol)) {
      this.state.set(symbol, { lastRebalanceAt: null, lastDCAAt: null });
    }
    return this.state.get(symbol);
  }

  /** Decide whether to rebalance or DCA this bar */
  analyze(symbol, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist?.length || !marketData?.accountValue) {
      return { signal: 'HOLD', strength: 0, reason: 'Waiting for account/hist' };
    }
    const now = hist[hist.length - 1].time ? new Date(hist[hist.length - 1].time) : new Date();
    const st = this._ensureState(symbol);
    const price = marketData.lastPrice;
    const accountValue = marketData.accountValue;

    // Determine target weight (possibly glide-path adjusted)
    const targetW = this._computeTargetWeight();
    const currW   = this._currentWeight(symbol, accountValue, marketData);
    const drift   = currW - targetW;

    const reasons = [];
    // Check calendar-based rebalance
    let calendarDue = false;
    if (this.config.rebalanceEveryDays != null) {
      const next = st.lastRebalanceAt ? new Date(st.lastRebalanceAt) : null;
      if (!next) calendarDue = true; // first time
      else {
        const ms = (now - next) / (1000 * 60 * 60 * 24);
        calendarDue = ms >= this.config.rebalanceEveryDays;
      }
    }

    // Check drift band
    const driftExceeded = Math.abs(drift) >= this.config.rebalanceBand;

    // Anti-churn: minimum spacing between rebalances
    const canRebalanceAgain = (() => {
      if (!st.lastRebalanceAt) return true;
      const since = (now - new Date(st.lastRebalanceAt)) / (1000*60*60*24);
      return since >= this.config.minRebalanceDays;
    })();

    // DCA due?
    let dcaDue = false;
    if ((this.config.dcaContributionUSD || 0) > 0) {
      if (!st.lastDCAAt) dcaDue = true;
      else {
        const sinceD = (now - new Date(st.lastDCAAt)) / (1000*60*60*24);
        dcaDue = sinceD >= this.config.dcaEveryDays;
      }
    }

    // Decide actions
    if (canRebalanceAgain && (calendarDue || driftExceeded)) {
      // If overweight: SELL; if underweight: BUY.
      const direction = drift > 0 ? 'SELL' : 'BUY';
      const strength = 80;
      reasons.push(calendarDue ? 'Calendar rebalance due' : 'Drift band exceeded');
      return { signal: direction, strength, reasons, intent: 'REBALANCE', targetWeight: targetW, currentWeight: currW };
    }

    if (dcaDue) {
      return { signal: 'BUY', strength: 50, reasons: ['DCA contribution'], intent: 'DCA' };
    }

    return { signal: 'HOLD', strength: 0, reasons: ['On target'] };
  }

  /**
   * Passive sizing:
   * - For REBALANCE intent: compute quantity needed to move toward target weight.
   * - For DCA intent: buy floor(dcaUSD / price).
   * - Clamp by maxPositionSize.
   */
  calculatePositionSize(symbol, price, accountValue, analyzeResult) {
    const maxVal = Math.min(this.config.riskManagement.maxPositionSize, accountValue);
    const position = this.getPosition?.(symbol);
    const currentQty = position?.quantity || 0;
    const currentVal = currentQty * price;

    if (analyzeResult?.intent === 'REBALANCE') {
      const targetVal = Math.max(0, accountValue * this._computeTargetWeight());
      const deltaVal  = targetVal - currentVal; // >0 buy, <0 sell
      const rawQty    = Math.floor(Math.abs(deltaVal) / price);
      const maxQtyByCap = Math.floor(maxVal / price);
      return Math.max(0, Math.min(rawQty, maxQtyByCap));
    }

    if (analyzeResult?.intent === 'DCA') {
      const dcaUSD = this.config.dcaContributionUSD || 0;
      const rawQty = Math.floor(dcaUSD / price);
      const maxQtyByCap = Math.floor((maxVal - currentVal) / price);
      return Math.max(0, Math.min(rawQty, maxQtyByCap));
    }

    // Default: no action
    return 0;
  }

  /** Passive strategy typically does not use SL/TP; returns nulls */
  calculateStops(symbol, entryPrice, positionSide) {
    return { stopLoss: null, takeProfit: null };
  }

  /** Mark timestamps when we act, and exit only if short not allowed */
  postOrderFilled(symbol, order, fill) {
    const st = this._ensureState(symbol);
    if (order?.meta?.intent === 'REBALANCE') st.lastRebalanceAt = new Date().toISOString();
    if (order?.meta?.intent === 'DCA') st.lastDCAAt = new Date().toISOString();
  }

  /** No active exit logic; respect global risk controls (if any). */
  checkExitSignal(symbol, position, marketData) {
    if (!position) return { signal: 'HOLD', reason: 'No position' };
    if (!this.config.riskManagement.allowShort && position.side === 'short') {
      return { signal: 'EXIT', reason: 'Shorts disabled in passive strategy' };
    }
    return { signal: 'HOLD', reason: 'Hold long-term' };
  }
}
