
# Alexander Elder Strategy Pack

Implements systems and indicators from **Trading for a Living**:

- **Elder Triple Screen** (weekly MACD‑Histogram slope for trend, daily oscillator pullbacks, ATR risk).
- **Elder‑ray** (Bull/Bear Power around EMA trend).
- **Force Index** (volume‑weighted momentum pullbacks).
- **Risk module** with per‑trade risk and monthly drawdown cap.

## Files
- `strategies/elder-triple-screen-strategy.js`
- `strategies/elder-ray-strategy.js`
- `strategies/force-index-strategy.js`
- `lib/elder-risk-manager.js`

## Minimal config (`config/strategies.json`)
```json
{
  "enabled": [
    {
      "name": "elder-triple-screen",
      "config": {
        "enabled": true,
        "allocation": 0.34,
        "macdFast": 12, "macdSlow": 26, "macdSignal": 9,
        "rsiLen": 2, "rsiBuy": 25, "rsiSell": 75,
        "atrLen": 14, "stopATR": 2.0, "trailATR": 3.0,
        "riskPerTradeUSD": 1000
      }
    },
    {
      "name": "elder-ray",
      "config": { "enabled": false, "allocation": 0.33, "emaLen": 13, "atrLen": 14 }
    },
    {
      "name": "force-index",
      "config": { "enabled": false, "allocation": 0.33, "emaLenTrend": 22, "fiLen": 2, "fiSignal": 13 }
    }
  ]
}
```
