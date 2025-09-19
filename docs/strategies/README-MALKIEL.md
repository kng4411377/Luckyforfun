
# Random Walk (Malkiel) Passive Strategy

Implements a **buy-and-hold indexing** approach with **periodic rebalancing** and **DCA**.

## File
- `strategies/random-walk-passive-strategy.js`

## Config example (`config/strategies.json`)
```json
{
  "enabled": [
    {
      "name": "random-walk-passive",
      "config": {
        "enabled": true,
        "allocation": 0.5,
        "targetWeight": 0.6,
        "rebalanceBand": 0.05,
        "minRebalanceDays": 30,
        "rebalanceEveryDays": 90,
        "dcaContributionUSD": 1000,
        "dcaEveryDays": 30,
        "glidePath": { "enabled": false },
        "riskManagement": { "maxPositionSize": 1000000, "allowShort": false }
      }
    }
  ]
}
```

### Glide path (optional)
If you want age-based allocation, set:
```json
"glidePath": { "enabled": true, "age": 40, "assetClass": "equity", "formula": "110-minus-age" }
```
- Use `assetClass: "equity"` for an equity index symbol.
- Use `assetClass: "bond"` for your bond fund symbol.

## Notes
- Instantiate this per symbol (e.g., `SPY`, `AGG`, `VXUS`), each with its own `targetWeight`.
- The strategy emits `BUY`/`SELL` intents of type `DCA` or `REBALANCE`. Your order router can map these to market orders and attach metadata via `order.meta.intent`.
- Stops/TP are `null` by design—risk is handled by allocation, rebalancing, and your global guards.
