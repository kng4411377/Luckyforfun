
/**
 * Fisher Quality Growth Strategy (Scuttlebutt-inspired)
 *
 * Translates Philip A. Fisher's qualitative principles into a systematic,
 * configurable checklist + technical timing. The module expects that your
 * app can supply fundamental snapshots (per symbol) via marketData.fundamentals
 * or via BaseStrategy.getFundamentals(symbol) if you provide it.
 *
 * Core ideas mapped:
 *  - Durable growth runway (sales growth, TAM proxy)
 *  - High profit margins and improvement trend
 *  - R&D and product leadership (intensity vs. revenue)
 *  - Sales/org capability (SG&A efficiency proxy)
 *  - Moat & competitive position (gross margin stability, ROIC)
 *  - Management integrity & capital allocation (buybacks/dividends policy)
 *  - Optional scuttlebutt score hook: user-supplied 0..1 score
 *
 * Technical timing:
 *  - Accumulate on breakout above 52-week high with above-average volume
 *  - Add on pullbacks holding the 50/200 SMA (trend filter)
 *  - Exit if thesis breaks (score drops below threshold) or 200SMA breaks
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators as TI } from '../src/technical-indicators.js';
import { TradingLogger } from '../src/logger.js';

function pct(a, b) { return b === 0 ? 0 : (a - b) / b; }
function rollingMax(arr, lookback) {
  if (!arr || arr.length < lookback) return null;
  return Math.max(...arr.slice(-lookback));
}

export class FisherQualityGrowthStrategy extends BaseStrategy {
  constructor(config) {
    super('fisher-quality-growth', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Quality-growth checklist (Fisher) + breakout timing',
      timeframe: '1d',
      riskLevel: 'medium',
      requiredIndicators: ['SMA']
    };
    this.state = new Map();
  }

  async initialize() {
    // Defaults are conservative; tune per universe.
    this.config = {
      // Fundamental thresholds (any missing metric is skipped but lowers score)
      minSalesCAGR3Y: 0.10,          // >= 10%
      minGrossMargin: 0.45,          // >= 45%
      minROIC: 0.10,                 // >= 10%
      minRNDIntensity: 0.05,         // R&D / Revenue >= 5% (for tech/healthcare; adjust per sector)
      minOpMargin: 0.12,             // Operating margin >= 12%
      improvingMargins: true,        // last 3y margin trend positive
      maxDebtToEquity: 1.0,          // <= 1x
      minFreeCashFlowMargin: 0.05,   // >= 5%
      minScoreToBuy: 0.65,           // overall weighted score threshold to allow buys

      // Technical + risk settings
      breakoutLookback: 252,         // ~52-week high window
      baseSMA: 200,
      pullbackSMA: 50,
      minVolBoost: 1.3,              // volume vs 20d average on breakout
      addOnPullback: true,
      riskManagement: this.config?.riskManagement || {
        maxPositionSize: 25000,
        stopLossPercent: 0.12,       // wider stops for growth
        takeProfitPercent: null      // optional; can ride trend
      },
      positionSizing: {
        type: 'volatility',          // 'fixed' | 'volatility'
        fixedUSD: 10000,
        atrLookback: 20,
        atrRiskUSD: 1000             // risk per add (USD) if volatility sizing
      },
      weights: {
        growth: 0.25,
        margins: 0.20,
        returns: 0.15,
        innovation: 0.15,
        financials: 0.10,
        management: 0.10,
        scuttlebutt: 0.05
      },
      ...this.config
    };
    TradingLogger.logStrategy('Fisher Quality Growth initialized', this.config);
    return true;
  }

  getMaxHistoryLength() { return Math.max(260, this.config.baseSMA + 10); }

  /** Helper: fetch fundamentals from marketData or injected getter */
  _getFundamentals(symbol, marketData) {
    return marketData?.fundamentals || (this.getFundamentals?.(symbol)) || null;
  }

  /** Score fundamentals 0..1 for the Fisher checklist */
  _scoreFundamentals(f) {
    if (!f) return { score: 0, breakdown: { missing: 1 } };

    const w = this.config.weights;
    const parts = {};

    // Growth
    const growth = (f.salesCAGR3Y ?? 0);
    parts.growth = Math.max(0, Math.min(1, (growth - this.config.minSalesCAGR3Y) / 0.20)); // scale over 10%..30%

    // Margins (gross+operating) and trend
    const gm = f.grossMargin ?? 0;
    const om = f.operatingMargin ?? 0;
    const marginTrend = f.marginTrend3Y ?? 0; // e.g., slope > 0
    let marginsScore = 0.5 * Math.max(0, Math.min(1, (gm - this.config.minGrossMargin) / 0.20))
                     + 0.5 * Math.max(0, Math.min(1, (om - this.config.minOpMargin) / 0.15));
    if (this.config.improvingMargins) marginsScore *= (marginTrend > 0 ? 1.0 : 0.7);
    parts.margins = marginsScore;

    // Returns (ROIC as moat/capital allocation proxy)
    const roic = f.roic ?? 0;
    parts.returns = Math.max(0, Math.min(1, (roic - this.config.minROIC) / 0.15));

    // Innovation (R&D intensity or new-product ratio)
    const rnd = f.rndIntensity ?? 0;
    parts.innovation = Math.max(0, Math.min(1, (rnd - this.config.minRNDIntensity) / 0.10));

    // Financials (FCF margin, leverage)
    const fcfm = f.freeCashFlowMargin ?? 0;
    const dte  = f.debtToEquity ?? 0;
    const fcfScore = Math.max(0, Math.min(1, (fcfm - this.config.minFreeCashFlowMargin) / 0.10));
    const levScore = dte <= this.config.maxDebtToEquity ? 1 - (dte / (this.config.maxDebtToEquity * 2)) : 0; // taper
    parts.financials = Math.max(0, Math.min(1, 0.7 * fcfScore + 0.3 * levScore));

    // Management (buybacks/div policy consistency, dilution control)
    const buyback = f.netBuybackYield ?? 0; // positive = shrinking share count
    const dilution = f.shareDilution5Y ?? 0; // negative is good
    let mgmt = 0.5 * Math.max(0, Math.min(1, (buyback + 0.05) / 0.10)); // scale -5%..+5%
    mgmt *= (dilution <= 0 ? 1.0 : 0.6);
    parts.management = mgmt;

    // Scuttlebutt (external input 0..1)
    parts.scuttlebutt = Math.max(0, Math.min(1, f.scuttlebuttScore ?? 0.5));

    // Weighted total (normalize weights)
    const sumW = Object.values(this.config.weights).reduce((a,b) => a+b, 0);
    let total = 0;
    for (const k in parts) { total += (parts[k] || 0) * ((this.config.weights[k] || 0) / sumW); }

    return { score: Math.max(0, Math.min(1, total)), breakdown: parts };
  }

  _ensureState(symbol) {
    if (!this.state.has(symbol)) this.state.set(symbol, { lastAddAt: null, thesisScore: 0 });
    return this.state.get(symbol);
  }

  analyze(symbol, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist || hist.length < this.getMaxHistoryLength()) {
      return { signal: 'HOLD', strength: 0, reason: 'Insufficient price history' };
    }
    const prices = hist.map(h => h.price);
    const volumes = hist.map(h => h.volume ?? 0);
    const sma200 = TI.sma(prices, this.config.baseSMA);
    const sma50  = TI.sma(prices, this.config.pullbackSMA);
    const price  = prices[prices.length - 1];
    const above200 = price > sma200;
    const above50  = price > sma50;

    // Fundamentals score
    const f = this._getFundamentals(symbol, marketData);
    const fs = this._scoreFundamentals(f);
    const st = this._ensureState(symbol);
    st.thesisScore = fs.score;

    if (fs.score < this.config.minScoreToBuy) {
      return { signal: 'HOLD', strength: 0, reasons: ['Score below threshold'], fundamentals: fs };
    }

    // Breakout condition
    const hi52 = rollingMax(prices.slice(0, -1), this.config.breakoutLookback) ?? price;
    const avgVol20 = TI.sma(volumes, 20);
    const volBoost = (volumes[volumes.length - 1] || 0) / Math.max(1, avgVol20);
    const breakout = price > hi52 && volBoost >= this.config.minVolBoost && above200;

    if (breakout) {
      return { signal: 'BUY', strength: Math.round(70 + 20 * (fs.score - this.config.minScoreToBuy)), reasons: ['52w breakout + vol', `Score=${fs.score.toFixed(2)}`], fundamentals: fs, intent: 'INIT' };
    }

    // Add on pullback: price above 200SMA, dips to 50SMA and holds
    if (this.config.addOnPullback && above200 && price > sma50 && prices[prices.length - 2] <= sma50) {
      return { signal: 'BUY', strength: 55, reasons: ['Pullback add near 50SMA'], fundamentals: fs, intent: 'ADD' };
    }

    return { signal: 'HOLD', strength: 0, reasons: ['No trigger'], fundamentals: fs };
  }

  calculatePositionSize(symbol, price, accountValue, analyzeResult) {
    const capUSD = Math.min(this.config.riskManagement.maxPositionSize, accountValue * 0.2);
    if (this.config.positionSizing.type === 'fixed') {
      const qty = Math.floor((this.config.positionSizing.fixedUSD || 5000) / price);
      return Math.max(0, Math.min(qty, Math.floor(capUSD / price)));
    }
    // volatility-based (ATR sizing)
    const hist = this.getPriceHistory(symbol);
    const closes = hist.map(h => h.price);
    const highs  = hist.map(h => h.high ?? h.price);
    const lows   = hist.map(h => h.low  ?? h.price);
    const atr = TI.atr(highs, lows, closes, this.config.positionSizing.atrLookback ?? 20) || (price * 0.02);
    const riskPerShare = Math.max(0.5 * atr, price * (this.config.riskManagement.stopLossPercent ?? 0.12));
    const qty = Math.floor((this.config.positionSizing.atrRiskUSD || 1000) / Math.max(1e-6, riskPerShare));
    return Math.max(0, Math.min(qty, Math.floor(capUSD / price)));
  }

  calculateStops(symbol, entryPrice, positionSide) {
    const slPct = this.config.riskManagement.stopLossPercent ?? 0.12;
    const tpPct = this.config.riskManagement.takeProfitPercent;
    return {
      stopLoss: entryPrice * (1 - slPct),
      takeProfit: tpPct ? entryPrice * (1 + tpPct) : null
    };
  }

  checkExitSignal(symbol, position, marketData) {
    const hist = this.getPriceHistory(symbol);
    if (!hist?.length) return { signal: 'HOLD', reason: 'No data' };
    const prices = hist.map(h => h.price);
    const price = prices[prices.length - 1];
    const sma200 = TI.sma(prices, this.config.baseSMA);

    // Thesis break: score fell materially below threshold (with hysteresis)
    const st = this._ensureState(symbol);
    if ((st.thesisScore || 0) < (this.config.minScoreToBuy - 0.10)) {
      return { signal: 'EXIT', reason: 'Fundamental score dropped' };
    }
    // Long-term trend break
    if (position?.side === 'long' && price < sma200) {
      return { signal: 'EXIT', reason: 'Lost 200SMA' };
    }
    return { signal: 'HOLD', reason: 'Hold' };
  }
}
