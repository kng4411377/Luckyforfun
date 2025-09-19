
/**
 * Graham Net-Net (NCAV) Strategy
 *
 * Classic deep-value approach:
 *  - Compute Net Current Asset Value (NCAV) = Current Assets - Total Liabilities
 *  - Buy if Price < 0.67 * (NCAV / shares)
 *  - Quality guards: positive operating cash flow, no distress flags
 *  - Diversify across a basket (small positions), sell on mean reversion (P/NCAV > 1.0)
 *
 * WARNING: This is illiquid/micro-cap heavy. Use strict liquidity filters in production.
 */
import { BaseStrategy } from '../src/base-strategy.js';
import { TradingLogger } from '../src/logger.js';

export class GrahamNetNetStrategy extends BaseStrategy {
  constructor(config) {
    super('graham-netnet', config);
    this.metadata = {
      version: '1.0.0',
      author: 'ChatGPT',
      description: 'Graham Net-Net (NCAV) deep value screen',
      timeframe: '1d',
      riskLevel: 'high',
      requiredIndicators: []
    };
  }

  async initialize() {
    this.config = {
      maxPositionSize: 5000,              // small tickets; diversify
      minAvgDollarVolume: 200000,         // liquidity floor: $200k/day
      buyPtoNCAV: 0.67,                   // classic Graham cutoff
      sellPtoNCAV: 1.0,                   // take profits at NCAV\n      // Guards\n      requirePositiveOCF: true,\n      excludeFinancials: true,\n      excludeDistress: true,\n      ...this.config\n    };\n    return true;\n  }\n\n  getMaxHistoryLength() { return 5; }\n\n  _getFundamentals(symbol, marketData) {\n    return marketData?.fundamentals || (this.getFundamentals?.(symbol)) || null;\n  }\n\n  analyze(symbol, marketData) {\n    const f = this._getFundamentals(symbol, marketData);\n    if (!f) return { signal: 'HOLD', strength: 0, reason: 'No fundamentals' };\n\n    // Liquidity guard\n    if ((f.avgDollarVolume || 0) < this.config.minAvgDollarVolume) {\n      return { signal: 'HOLD', strength: 0, reason: 'Illiquid' };\n    }\n\n    if (this.config.excludeFinancials && f.sector === 'Financials') {\n      return { signal: 'HOLD', strength: 0, reason: 'Excluded sector' };\n    }\n\n    // NCAV per share\n    const currentAssets = f.currentAssets ?? null;\n    const totalLiabilities = f.totalLiabilities ?? null;\n    const sharesOut = f.sharesOutstanding ?? null;\n    if (currentAssets==null || totalLiabilities==null || sharesOut==null || sharesOut<=0) {\n      return { signal: 'HOLD', strength: 0, reason: 'Missing NCAV inputs' };\n    }\n    const ncav = currentAssets - totalLiabilities;\n    const ncavPS = ncav / sharesOut;\n\n    const price = marketData?.lastPrice;\n    if (price==null) return { signal: 'HOLD', strength: 0, reason: 'No price' };\n\n    const pToNCAV = price / Math.max(1e-6, ncavPS);\n\n    // Guards\n    if (this.config.requirePositiveOCF && (f.operatingCashFlowTTM ?? 0) <= 0) {\n      return { signal: 'HOLD', strength: 0, reason: 'Negative OCF' };\n    }\n    if (this.config.excludeDistress && (f.altmanZ ?? 3) < 1.8) {\n      return { signal: 'HOLD', strength: 0, reason: 'Distress risk' };\n    }\n\n    if (pToNCAV <= this.config.buyPtoNCAV) {\n      return { signal: 'BUY', strength: 65, reasons: [`P/NCAV=${pToNCAV.toFixed(2)}<=${this.config.buyPtoNCAV}`], ncavPS };\n    }\n    return { signal: 'HOLD', strength: 0, reasons: [`P/NCAV=${pToNCAV.toFixed(2)}`], ncavPS };\n  }\n\n  calculatePositionSize(symbol, price, accountValue) {\n    const cap = Math.min(this.config.maxPositionSize, accountValue * 0.02); // tiny per name\n    return Math.max(0, Math.floor(cap / Math.max(1e-6, price)));\n  }\n\n  calculateStops(symbol, entryPrice, positionSide) {\n    // Often run without tight stops; optional 25% disaster stop\n    return { stopLoss: entryPrice * 0.75, takeProfit: null };\n  }\n\n  checkExitSignal(symbol, position, marketData) {\n    const f = this._getFundamentals(symbol, marketData);\n    if (!f) return { signal: 'HOLD', reason: 'No fundamentals' };\n    const currentAssets = f.currentAssets ?? 0; const totalLiabilities = f.totalLiabilities ?? 0; const sharesOut = f.sharesOutstanding || 1;\n    const ncavPS = (currentAssets - totalLiabilities) / Math.max(1, sharesOut);\n    const price = marketData?.lastPrice || 0;\n    const pToNCAV = price / Math.max(1e-6, ncavPS);\n\n    if (pToNCAV >= this.config.sellPtoNCAV) return { signal: 'EXIT', reason: 'P/NCAV >= target' };\n    return { signal: 'HOLD', reason: 'Hold' };\n  }\n}\n