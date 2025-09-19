
# "Market Wizards" Strategy Pack (Inspiration)

A collection of robust, modular strategies inspired by themes in *Unknown Market Wizards* & the wider series (breakouts, trend, and short‑term mean reversion).

## Files
- `strategies/donchian-breakout-strategy.js` — Donchian/Turtle breakout with ATR sizing, exit on 20‑day opposite channel.
- `strategies/rsi2-mean-reversion-strategy.js` — Daily RSI(2) pullback entries in uptrends.
- `strategies/voltarget-trend-strategy.js` — Trend with volatility targeting (position size scales to realized vol).
- `lib/kelly-sizer.js` — capped Kelly fraction helper.
- `lib/equity-curve-filter.js` — pause/allow trading based on strategy equity curve.

## Config example
```json
{
  "enabled": [
    { "name": "donchian-breakout", "config": { "enabled": true, "allocation": 0.5, "channelLenEntry": 55, "channelLenExit": 20, "riskPerUnitUSD": 1000, "unitsMax": 4 } },
    { "name": "rsi2-mean-reversion", "config": { "enabled": false, "allocation": 0.25, "buyLevel": 10, "sellLevel": 80 } },
    { "name": "voltarget-trend", "config": { "enabled": false, "allocation": 0.25, "fast": 50, "slow": 200, "targetVol": 0.15 } }
  ]
}
```
