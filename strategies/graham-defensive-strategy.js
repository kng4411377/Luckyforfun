
/**
 * Graham Defensive Investor Strategy
 *
 * Encodes Benjamin Graham's "defensive investor" criteria into a systematic screen
 * plus conservative timing to avoid deep value traps.
 *
 * Key criteria (configurable):
 *  - Adequate size (market cap floor)
 *  - Strong financial condition (currentRatio, debtToEquity)
 *  - Earnings stability: positive EPS for 10 years
 *  - Dividend record: paid dividends for 10 years
 *  - Earnings growth: >= X% over 10 years (or 3y CAGR proxy)
 *  - Moderate valuation: P/E, P/B thresholds
 * Optional: sector-specific relaxations.
 *
 * Timing:
 *  - Only buy when price above 200SMA (avoid deteriorating trends)
 *  - Rebalance annually or when valuation mean reverts (sell when P/E or P/B exceed upper bands)
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';
import { TradingLogger } from '../src/logger.js';

export class GrahamDefensiveStrategy extends BaseStrategy {
  constructor(config) {
    super('graham-defensive', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Graham Defensive screen + conservative timing',
      timeframe: '1d',
      riskLevel: 'low',
      requiredIndicators: ['SMA']
    };
    this.state = new Map();
  }

  async initialize() {
    this.config = {
      minMarketCapUSD: 2000000000,     // ≥ $2B
      minCurrentRatio: 1.5,            // current assets / current liabilities
      maxDebtToEquity: 0.5,
      minYearsPositiveEPS: 10,
      minYearsDividends: 10,
      minEarningsGrowth10Y: 0.30,      // e.g., ≥30% over 10y (approx CAGR ~2.7%)
      maxPE: 15,
      maxPB: 1.5,
      // sell bands: take profit (valuation mean reversion)
      sellPE: 20,
      sellPB: 2.5,

      baseSMA: 200,
      rebalanceEveryDays: 365,
      riskManagement: this.config?.riskManagement || {
        maxPositionSize: 20000,
        stopLossPercent: 0.10,  // optional stop; Graham is long-term, but guard catastrophic declines
        takeProfitPercent: null
      },
      positionSizing: {
        type: 'fixed',           // default to fixed USD tickets
        fixedUSD: 5000
      },
      ...this.config
    };
    return true;
  }

  getMaxHistoryLength() { return Math.max(260, this.config.baseSMA + 10); }

  _ensureState(symbol) {
    if (!this.state.has(symbol)) this.state.set(symbol, { lastRebalanceAt: null });
    return this.state.get(symbol);
  }

  _ok(val) { return val !== null && val !== undefined; }

  _getFundamentals(symbol, marketData) {
    return marketData?.fundamentals || (this.getFundamentals?.(symbol)) || null;
  }

  _passesDefensive(f) {
    if (!f) return { pass: false, reasons: ['No fundamentals'] };
    const reasons = [];

    if (this._ok(f.marketCapUSD) && f.marketCapUSD < this.config.minMarketCapUSD) reasons.push('Too small');
    if (this._ok(f.currentRatio) && f.currentRatio < this.config.minCurrentRatio) reasons.push('Weak current ratio');
    if (this._ok(f.debtToEquity) && f.debtToEquity > this.config.maxDebtToEquity) reasons.push('High leverage');
    if (this._ok(f.yearsPositiveEPS) && f.yearsPositiveEPS < this.config.minYearsPositiveEPS) reasons.push('EPS <10y');
    if (this._ok(f.yearsDividends) && f.yearsDividends < this.config.minYearsDividends) reasons.push('Dividend <10y');
    if (this._ok(f.earningsGrowth10Y) && f.earningsGrowth10Y < this.config.minEarningsGrowth10Y) reasons.push('Low 10y growth');

    // Valuation
    if (this._ok(f.pe) && f.pe > this.config.maxPE) reasons.push('P/E too high');
    if (this._ok(f.pb) && f.pb > this.config.maxPB) reasons.push('P/B too high');

    return { pass: reasons.length === 0, reasons };
  }

  analyze(symbol, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist || hist.length < this.getMaxHistoryLength()) {
      return { signal: 'HOLD', strength: 0, reason: 'Insufficient price data' };
    }
    const prices = hist.map(h => h.price);
    const price  = prices[prices.length - 1];
    const sma200 = TI.sma(prices, this.config.baseSMA);
    const above200 = price > sma200;

    const f = this._getFundamentals(symbol, marketData);
    const d = this._passesDefensive(f);
    if (!d.pass) {
      return { signal: 'HOLD', strength: 0, reasons: d.reasons };
    }

    // Timing: buy only if trend supportive
    if (above200) {
      return { signal: 'BUY', strength: 60, reasons: ['Passes defensive screen', 'Above 200SMA'], fundamentals: f };
    }
    return { signal: 'HOLD', strength: 0, reasons: ['Passes screen but below 200SMA'], fundamentals: f };
  }

  calculatePositionSize(symbol, price, accountValue) {
    if (this.config.positionSizing.type === 'fixed') {
      const usd = this.config.positionSizing.fixedUSD || 5000;
      const cap = Math.min(this.config.riskManagement.maxPositionSize, accountValue * 0.2);
      return Math.max(0, Math.min(Math.floor(usd / price), Math.floor(cap / price)));
    }
    // % of equity sizing
    const pctEq = this.config.positionSizing.pctEquity || 0.05; // 5%
    const target = Math.min(accountValue * pctEq, this.config.riskManagement.maxPositionSize);
    return Math.max(0, Math.floor(target / price));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const slPct = this.config.riskManagement.stopLossPercent ?? null;
    const tpPct = this.config.riskManagement.takeProfitPercent ?? null;
    return {
      stopLoss: slPct ? entryPrice * (1 - slPct) : null,
      takeProfit: tpPct ? entryPrice * (1 + tpPct) : null
    };
  }

  checkExitSignal(symbol, position, marketData) {
    const f = this._getFundamentals(symbol, marketData) || {};
    // Valuation mean reversion: sell when rich
    if (this._ok(f.pe) && f.pe > this.config.sellPE) return { signal: 'EXIT', reason: 'PE above sell band' };
    if (this._ok(f.pb) && f.pb > this.config.sellPB) return { signal: 'EXIT', reason: 'PB above sell band' };

    // Trend breakdown
    const hist = this.getPriceHistory(symbol);
    if (hist?.length) {
      const price = hist[hist.length - 1].price;
      const sma200 = TI.sma(hist.map(h => h.price), this.config.baseSMA);
      if (position?.side === 'long' && price < sma200) return { signal: 'EXIT', reason: 'Lost 200SMA' };
    }
    return { signal: 'HOLD', reason: 'Hold' };
  }
}
