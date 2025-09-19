
# Benjamin Graham Strategy Pack

Two modules translating *The Intelligent Investor* into systematic strategies
that plug into your app's `BaseStrategy` + `TechnicalIndicators` framework.

## Files
- `strategies/graham-defensive-strategy.js` — Defensive investor screen + conservative timing
- `strategies/graham-netnet-strategy.js` — Net-Net (NCAV) deep-value approach

## Config examples (`config/strategies.json`)
```json
{
  "enabled": [
    {
      "name": "graham-defensive",
      "config": {
        "enabled": true,
        "allocation": 0.4,
        "minMarketCapUSD": 2000000000,
        "minCurrentRatio": 1.5,
        "maxDebtToEquity": 0.5,
        "minYearsPositiveEPS": 10,
        "minYearsDividends": 10,
        "minEarningsGrowth10Y": 0.30,
        "maxPE": 15,
        "maxPB": 1.5,
        "sellPE": 20,
        "sellPB": 2.5,
        "baseSMA": 200,
        "positionSizing": { "type": "fixed", "fixedUSD": 5000 },
        "riskManagement": { "maxPositionSize": 20000, "stopLossPercent": 0.10 }
      }
    },
    {
      "name": "graham-netnet",
      "config": {
        "enabled": false,
        "allocation": 0.2,
        "buyPtoNCAV": 0.67,
        "sellPtoNCAV": 1.0,
        "minAvgDollarVolume": 200000,
        "requirePositiveOCF": true,
        "excludeFinancials": true,
        "excludeDistress": true
      }
    }
  ]
}
```

## Fundamentals expected
Common fields (per symbol). Provide via `marketData.fundamentals` or implement `BaseStrategy.getFundamentals(symbol)`.

### graham-defensive
- `marketCapUSD`
- `currentRatio`
- `debtToEquity`
- `yearsPositiveEPS`
- `yearsDividends`
- `earningsGrowth10Y` (or 10y EPS CAGR proxy)
- `pe`, `pb`

### graham-netnet
- `currentAssets`
- `totalLiabilities`
- `sharesOutstanding`
- `operatingCashFlowTTM`
- `avgDollarVolume`
- `sector`
- `altmanZ` (optional)

## Notes
- Graham intended **diversification** and **patience**. For Net-Net, spread across many names and use strict liquidity filters.
- The defensive screen aims for quality/cheap; add sector overrides (e.g., utilities/financials) if needed.
