
# Fisher Quality Growth Strategy (Philip A. Fisher)

This module turns Fisher's qualitative **scuttlebutt** approach into a
**systematic quality-growth strategy** that your app can run.

## Files
- `strategies/fisher-quality-growth-strategy.js`

## Config (`config/strategies.json`)
```json
{
  "enabled": [
    {
      "name": "fisher-quality-growth",
      "config": {
        "enabled": true,
        "allocation": 0.33,
        "minSalesCAGR3Y": 0.10,
        "minGrossMargin": 0.45,
        "minROIC": 0.10,
        "minRNDIntensity": 0.05,
        "minOpMargin": 0.12,
        "maxDebtToEquity": 1.0,
        "minFreeCashFlowMargin": 0.05,
        "minScoreToBuy": 0.65,
        "breakoutLookback": 252,
        "baseSMA": 200,
        "pullbackSMA": 50,
        "minVolBoost": 1.3,
        "addOnPullback": true,
        "positionSizing": { "type": "volatility", "atrLookback": 20, "atrRiskUSD": 1000 },
        "riskManagement": { "maxPositionSize": 25000, "stopLossPercent": 0.12, "takeProfitPercent": null }
      }
    }
  ]
}
```

## Fundamentals expected (per symbol)
Provide via `marketData.fundamentals` or implement `BaseStrategy.getFundamentals(symbol)`.
All values are floats (fractions for percentages):
- `salesCAGR3Y` (e.g., 0.18 for 18%)
- `grossMargin`, `operatingMargin`
- `marginTrend3Y` (positive if improving)
- `roic`
- `rndIntensity` (R&D / Revenue)
- `freeCashFlowMargin`
- `debtToEquity`
- `netBuybackYield` (positive = net buyback)
- `shareDilution5Y` (negative is good)
- `scuttlebuttScore` (0..1) — optional human input

## How it trades
- **Filter**: requires overall score ≥ `minScoreToBuy`.
- **Entry**: 52‑week **breakout** above previous high with volume boost and price above 200‑SMA.
- **Adds**: pullbacks that bounce near the 50‑SMA while above the 200‑SMA.
- **Exit**: thesis break (score < threshold − 0.10) or price < 200‑SMA.

> Tune thresholds per sector (e.g., lower R&D intensity for consumer staples).
