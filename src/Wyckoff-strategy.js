/*
  Wyckoff Strategy – Node.js module (ESM)
  ------------------------------------------------------------
  Implements a practical, tunable version of ideas inspired by
  《新威科夫操盘法》/ Wyckoff Method:
  - Phase approximation (Accumulation, Markup, Distribution, Markdown)
  - Box range detection & breakout + test confirmation
  - Volume/Spread tests (VSA-lite)
  - Volatility/Trend filters
  - Position sizing & risk management
  - Basic backtest runner

  Usage (ESM):
    import { WyckoffStrategy, defaultParams } from './wyckoff-strategy.js';

    const strat = new WyckoffStrategy({ ...defaultParams, breakoutVolumeMultiplier: 1.8 });
    const { signals } = strat.run(bars);
    // bars = [{ time, open, high, low, close, volume }, ...]

  Notes:
  - This is educational code and not investment advice.
  - Works with daily/any timeframe as long as OHLCV are consistent.
*/

export const defaultParams = {
  // Phase detection & structure
  lookback: 60,                 // bars for structural detection
  boxMinBars: 10,               // min bars to consider a consolidation box
  boxRangePct: 0.08,            // max box height relative to mid-price (e.g., 8%)
  phaseTrendMA: 20,             // MA length for trend filter in phase detection
  phaseSensitivity: 0.6,        // 0..1 higher = stricter (needs tighter boxes / clearer ranges)

  // Breakout & Test confirmation
  breakoutBufferPct: 0.002,     // small buffer above/below box boundary
  breakoutVolumeMultiplier: 2.0,// volume vs median-volume of box
  testMaxPullbackPct: 0.5,      // after breakout, max pullback as % of box height (<=50%)
  testRetestBars: 6,            // confirmation window bars

  // Volume/Spread heuristics (VSA-lite)
  highVolumePctile: 0.8,        // top 20% volume considered high
  wideSpreadPctile: 0.75,       // top 25% spread considered wide

  // Risk & Money Management
  riskPerTradePct: 0.01,        // 1% of equity per position
  atrLen: 14,                   // ATR length
  stopATR: 2.5,                 // initial stop = entry −/+ k * ATR
  trailATR: 2.8,                // trailing stop multiple
  maxPositions: 5,              // portfolio cap in backtests

  // Misc filters
  minAvgDollarVol: 0,           // optional liquidity filter: avg(close*vol)
  trendMA: 50,                  // higher timeframe trend filter
  atrVolatilityFloor: 0,        // require ATR% above a floor (0 disables)
};

// ------------------------ Utilities ------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sma = (arr, n) => {
  const out = Array(arr.length).fill(null);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
    if (i >= n) s -= arr[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
};

const trueRange = (bars, i) => {
  if (i === 0) return bars[0].high - bars[0].low;
  const prevClose = bars[i - 1].close;
  return Math.max(
    bars[i].high - bars[i].low,
    Math.abs(bars[i].high - prevClose),
    Math.abs(bars[i].low - prevClose)
  );
};

const atr = (bars, n) => {
  const out = Array(bars.length).fill(null);
  let s = 0;
  for (let i = 0; i < bars.length; i++) {
    const tr = trueRange(bars, i);
    s += tr;
    if (i >= n) s -= trueRange(bars, i - n);
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
};

const percentile = (arr, p) => {
  const a = arr.filter(x => Number.isFinite(x)).slice().sort((x,y)=>x-y);
  if (!a.length) return NaN;
  const idx = clamp((a.length - 1) * p, 0, a.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (idx - lo);
};

const rollingPercentile = (arr, n, p) => {
  const out = Array(arr.length).fill(null);
  const win = [];
  for (let i = 0; i < arr.length; i++) {
    win.push(arr[i]);
    if (win.length > n) win.shift();
    out[i] = percentile(win, p);
  }
  return out;
};

const median = (xs) => {
  const a = xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if (!a.length) return NaN;
  const mid = Math.floor(a.length/2);
  return a.length % 2 ? a[mid] : (a[mid-1] + a[mid]) / 2;
};

const avg = (xs) => xs.reduce((a,b)=>a+b,0) / (xs.length || 1);

// Identify most recent consolidation "box" within lookback window
function findBox(bars, i, { lookback, boxMinBars, boxRangePct, phaseSensitivity }) {
  const start = Math.max(0, i - lookback + 1);
  let best = null;
  for (let a = i - boxMinBars + 1; a >= start; a--) {
    const slice = bars.slice(a, i + 1);
    const highs = slice.map(b => b.high);
    const lows  = slice.map(b => b.low);
    const hi = Math.max(...highs);
    const lo = Math.min(...lows);
    const mid = (hi + lo) / 2;
    const height = hi - lo;
    const rangePct = height / Math.max(1e-9, mid);
    // compactness penalty: use std dev of closes inside
    const closes = slice.map(b => b.close);
    const mu = avg(closes);
    const stdev = Math.sqrt(avg(closes.map(x => (x - mu) ** 2)));
    const compact = stdev / Math.max(1e-9, mu);

    if (slice.length >= boxMinBars && rangePct <= boxRangePct * (1 + (1 - phaseSensitivity))) {
      const score = (slice.length) / (1 + rangePct + compact); // longer & tighter is better
      if (!best || score > best.score) {
        best = { from: a, to: i, hi, lo, mid, height, bars: slice.length, score };
      }
    }
  }
  return best; // may be null
}

function lastN(arr, n) { return arr.slice(Math.max(0, arr.length - n)); }

// --------------------- Core Strategy Class ---------------------
export class WyckoffStrategy {
  constructor(params = {}) {
    this.p = { ...defaultParams, ...params };
  }

  run(bars, { equity = 100000 } = {}) {
    if (!Array.isArray(bars) || bars.length === 0) throw new Error('bars required');
    const { p } = this;

    // Precompute indicators
    const closes = bars.map(b => b.close);
    const highs  = bars.map(b => b.high);
    const lows   = bars.map(b => b.low);
    const vols   = bars.map(b => b.volume);

    const maTrend = sma(closes, p.trendMA);
    const maPhase = sma(closes, p.phaseTrendMA);
    const aatr = atr(bars, p.atrLen);

    const spreads = bars.map((b,i)=> (b.high - b.low));
    const volHighPct = rollingPercentile(vols, p.lookback, p.highVolumePctile);
    const sprWidePct = rollingPercentile(spreads, p.lookback, p.wideSpreadPctile);

    const avgDollarVol = sma(bars.map(b => b.close * b.volume), p.lookback);

    const signals = []; // {i, time, type:'buy'|'sell'|'exit', reason, price, box}

    // Backtest state
    let positions = []; // { entryIdx, entryPrice, qty, stop, box, dir }
    let cash = equity;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const price = b.close;

      // Liquidity & volatility filters
      if (p.minAvgDollarVol && (!avgDollarVol[i] || avgDollarVol[i] < p.minAvgDollarVol)) {
        this._updateTrailingStops(positions, bars, i);
        this._maybeExitOnStops(positions, signals, bars, i);
        continue;
      }
      if (p.atrVolatilityFloor) {
        const atrPct = aatr[i] ? aatr[i] / price : 0;
        if (atrPct < p.atrVolatilityFloor) {
          this._updateTrailingStops(positions, bars, i);
          this._maybeExitOnStops(positions, signals, bars, i);
          continue;
        }
      }

      // Phase detection via box + trend
      const box = findBox(bars, i, p);
      const trendUp = maTrend[i] && price > maTrend[i];
      const trendDn = maTrend[i] && price < maTrend[i];

      // Try long-side Wyckoff: Accumulation -> breakout -> test -> markup
      if (box && trendUp) {
        const top = box.hi * (1 + p.breakoutBufferPct);
        const bot = box.lo * (1 - p.breakoutBufferPct);

        const inBox = price >= bot && price <= top;
        const brokeUp = price > top;

        // Breakout volume confirmation
        const boxVolMed = median(bars.slice(box.from, box.to+1).map(x=>x.volume));
        const volOK = b.volume >= (boxVolMed * p.breakoutVolumeMultiplier);

        // Wide spread day often accompanies genuine breakouts
        const spreadWide = spreads[i] >= (sprWidePct[i] || 0);
        const highVol = b.volume >= (volHighPct[i] || 0);

        // Entry condition: breakout + high vol + wide spread (all heuristic)
        if (brokeUp && volOK && (spreadWide || highVol)) {
          // Wait for a TEST (a.k.a. spring test) within next N bars: mild pullback on lower vol
          const test = this._lookForTest(bars, i, box, p);
          if (test) {
            const entry = test.entryPrice;
            const stp = entry - p.stopATR * (aatr[test.idx] || 0);
            const riskPerShare = Math.max(1e-6, entry - stp);
            const riskCapital = cash * p.riskPerTradePct;
            const qty = Math.floor(riskCapital / riskPerShare);

            if (qty > 0 && positions.length < p.maxPositions) {
              positions.push({ entryIdx: test.idx, entryPrice: entry, qty, stop: stp, box, dir: 'long' });
              cash -= qty * entry;
              signals.push({ i: test.idx, time: bars[test.idx].time, type: 'buy', reason: 'breakout+test', price: entry, box });
            }
          }
        }
      }

      // Distribution / exit heuristics: weakness in uptrend or break of trailing stop
      this._updateTrailingStops(positions, bars, i, p, aatr);
      this._maybeExitOnStops(positions, signals, bars, i);

      // Optional: explicit distribution cue = failed highs on high volume
      if (positions.some(pos => pos.dir==='long')) {
        const failHigh = i>1 && highs[i] < highs[i-1] && closes[i] < closes[i-1] && b.volume >= (volHighPct[i]||0);
        if (failHigh) {
          // scale-out half
          positions = this._scaleOut(positions, signals, bars, i, 0.5);
        }
      }
    }

    // Liquidate at end
    for (const pos of positions) {
      const px = bars[bars.length-1].close;
      signals.push({ i: bars.length-1, time: bars[bars.length-1].time, type: 'exit', reason: 'EOD', price: px });
    }

    return { signals };
  }

  _lookForTest(bars, i, box, p) {
    const height = box.height;
    const maxPull = p.testMaxPullbackPct * height;
    const top = box.hi * (1 + p.breakoutBufferPct);
    const start = i + 1;
    const end = Math.min(bars.length - 1, i + p.testRetestBars);

    // median vol in the breakout bar neighborhood
    const local = bars.slice(Math.max(0, i-5), Math.min(bars.length, i+6));
    const medVol = median(local.map(b => b.volume));

    for (let k = start; k <= end; k++) {
      const b = bars[k];
      const pull = Math.max(0, top - b.low); // how deep below breakout top
      const lowerVol = b.volume <= medVol;   // tests often on lower volume
      const closeStrong = b.close >= b.open; // demand stepping in

      if (pull <= maxPull && lowerVol && closeStrong) {
        // enter near close of the test bar
        return { idx: k, entryPrice: b.close };
      }
    }
    return null;
  }

  _updateTrailingStops(positions, bars, i, p = this.p, aatr = null) {
    for (const pos of positions) {
      if (pos.dir !== 'long') continue; // long-only in this implementation
      const atrNow = aatr ? (aatr[i] || aatr[aatr.length-1]) : (bars[i].high - bars[i].low);
      const trail = bars[i].close - p.trailATR * atrNow;
      pos.stop = Math.max(pos.stop, trail); // raise stop only
    }
  }

  _maybeExitOnStops(positions, signals, bars, i) {
    const keep = [];
    for (const pos of positions) {
      const px = bars[i].close;
      if (pos.dir === 'long' && px <= pos.stop) {
        signals.push({ i, time: bars[i].time, type: 'exit', reason: 'stop', price: px });
      } else {
        keep.push(pos);
      }
    }
    return (positions.length = 0, positions.push(...keep));
  }

  _scaleOut(positions, signals, bars, i, frac = 0.5) {
    const keep = [];
    for (const pos of positions) {
      const sellQty = Math.floor(pos.qty * frac);
      if (sellQty > 0) {
        signals.push({ i, time: bars[i].time, type: 'sell', reason: 'scale-out', price: bars[i].close });
        pos.qty -= sellQty;
      }
      if (pos.qty > 0) keep.push(pos);
    }
    return keep;
  }
}

/* ------------------------- Minimal Backtester -------------------------
   Purpose: turn signals into PnL for sanity checks.
   Assumes single instrument, FIFO fills at close price of signal bar.
*/
export function backtest(bars, signals, { equity = 100000 } = {}) {
  let cash = equity; let qty = 0; let entry = 0; let peak = equity; const trades = [];
  for (const s of signals) {
    const px = s.price ?? bars[s.i].close;
    if (s.type === 'buy') {
      const risk = equity * 0.01; // not exact position sizing (already done in strategy), just bookkeeping
      const q = Math.max(1, Math.floor(risk / Math.max(1e-6, px * 0.05)));
      cash -= q * px; qty += q; entry = px;
      trades.push({ side: 'long', entryPx: px, entryIdx: s.i });
    } else if (s.type === 'sell') {
      const q = Math.floor(qty * 0.5);
      cash += q * px; qty -= q;
    } else if (s.type === 'exit') {
      cash += qty * px; qty = 0;
      const last = trades[trades.length - 1];
      if (last && !last.exitPx) Object.assign(last, { exitPx: px, exitIdx: s.i, pnl: (px - last.entryPx) });
    }
  }
  const nav = cash + qty * (bars[bars.length-1]?.close || 0);
  return { nav, cash, qty, trades };
}

/* ------------------------- Example Usage -------------------------
import { WyckoffStrategy, defaultParams, backtest } from './wyckoff-strategy.js';

const strat = new WyckoffStrategy({ ...defaultParams, breakoutVolumeMultiplier: 1.6 });
const { signals } = strat.run(bars, { equity: 200000 });
const report = backtest(bars, signals, { equity: 200000 });
console.log(report);
*/
