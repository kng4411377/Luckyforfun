# ⚙️ Strategy Configuration Guide

This document provides a comprehensive guide to configuring all available trading strategies in the SDK.

## 📋 **Configuration Structure**

The main configuration file is located at `config/strategies.json` and has the following structure:

```json
{
  "enabled": [
    // Strategies that are currently active
  ],
  "available": [
    // Strategies that can be enabled (with full configurations)
  ],
  "global": {
    // Global strategy manager settings
  }
}
```

## 🎯 **Currently Enabled Strategies**

### 1. **Momentum Strategy**
**File**: `src/momentum-strategy.js`
**Type**: Trend Following | **Risk**: Medium

```json
{
  "name": "momentum",
  "config": {
    "enabled": true,
    "priority": 1,
    "allocation": 0.3,
    "momentum": {
      "lookbackDays": 20,           // Days to look back for momentum calculation
      "thresholdPercentage": 5.0,   // Minimum momentum % for signal
      "volumeThreshold": 1000000,   // Minimum average volume required
      "priceRange": {
        "min": 10.0,               // Minimum stock price
        "max": 1000.0              // Maximum stock price
      }
    },
    "technicalIndicators": {
      "rsi": {
        "period": 14,              // RSI calculation period
        "oversold": 30,            // RSI oversold threshold
        "overbought": 70           // RSI overbought threshold
      },
      "movingAverages": {
        "short": 10,               // Short MA period
        "long": 20                 // Long MA period
      },
      "bollinger": {
        "period": 20,              // Bollinger Band period
        "standardDeviations": 2    // Standard deviations for bands
      }
    },
    "riskManagement": {
      "maxPositions": 5,           // Maximum concurrent positions
      "maxPositionSize": 10000,    // Maximum USD per position
      "stopLossPercentage": 2.0,   // Stop loss %
      "takeProfitPercentage": 4.0, // Take profit %
      "trailingStopPercentage": 1.5, // Trailing stop %
      "riskRewardRatio": 2.0       // Minimum risk/reward ratio
    }
  }
}
```

### 2. **Mean Reversion Strategy**
**File**: `strategies/mean-reversion-strategy.js`
**Type**: Contrarian | **Risk**: Conservative

```json
{
  "name": "mean-reversion",
  "config": {
    "enabled": true,
    "priority": 2,
    "allocation": 0.2,
    "meanReversion": {
      "threshold": 3.0             // % deviation from mean for signal
    },
    "technicalIndicators": {
      "rsi": {
        "period": 14,
        "oversold": 30,
        "overbought": 70
      },
      "bollinger": {
        "period": 20,
        "standardDeviations": 2
      },
      "sma": {
        "period": 20               // Simple moving average period
      }
    },
    "riskManagement": {
      "maxPositionSize": 5000,     // Smaller positions for conservative approach
      "stopLossPercentage": 1.5,   // Tighter stops for mean reversion
      "takeProfitPercentage": 3.0
    }
  }
}
```

## 🔧 **Available Strategies** (Can be Enabled)

### 3. **Wyckoff V2 Strategy**
**File**: `strategies/wyckoff-v2-strategy.js`
**Type**: Accumulation/Distribution | **Risk**: Medium

```json
{
  "name": "wyckoff-v2",
  "config": {
    "lookback": 50,               // Bars to look back for range detection
    "flatTol": 0.03,              // Tolerance for flat range (3%)
    "riskManagement": {
      "maxPositionSize": 25000,
      "stopLossPercent": 0.02,    // 2% stop loss
      "takeProfitPercent": 0.05   // 5% take profit
    }
  }
}
```

### 4. **Elder Triple Screen Strategy**
**File**: `strategies/elder-triple-screen-strategy.js`
**Type**: Multi-Timeframe | **Risk**: Medium

```json
{
  "name": "elder-triple-screen",
  "config": {
    "macdFast": 12,               // MACD fast EMA
    "macdSlow": 26,               // MACD slow EMA
    "macdSignal": 9,              // MACD signal line
    "weeklyLookback": 120,        // Weekly data lookback
    "dailyTimeframe": "1d",       // Daily timeframe
    "weeklyTimeframe": "1w",      // Weekly timeframe
    "rsiLen": 2,                  // RSI period for entry
    "rsiBuy": 25,                 // RSI buy threshold
    "rsiSell": 75,                // RSI sell threshold
    "atrLen": 14,                 // ATR period
    "stopATR": 2.0,               // Stop loss in ATR multiples
    "trailATR": 3.0,              // Trailing stop in ATR multiples
    "riskPerTradeUSD": 1000,      // Risk per trade in USD
    "maxPositionSizeUSD": 25000   // Maximum position size
  }
}
```

### 5. **Donchian Breakout Strategy**
**File**: `strategies/donchian-breakout-strategy.js`
**Type**: Breakout/Trend Following | **Risk**: High

```json
{
  "name": "donchian-breakout",
  "config": {
    "channelLenEntry": 55,        // Entry channel length (days)
    "channelLenExit": 20,         // Exit channel length (days)
    "atrLen": 20,                 // ATR calculation period
    "riskPerUnitUSD": 1000,       // Risk per unit in USD
    "unitsMax": 4,                // Maximum units (pyramiding)
    "riskManagement": {
      "maxPositionSize": 25000,
      "stopLossPercent": 0.03,    // 3% stop loss
      "takeProfitPercent": null   // No fixed take profit
    }
  }
}
```

### 6. **Fisher Quality Growth Strategy**
**File**: `strategies/fisher-quality-growth-strategy.js`
**Type**: Growth/Quality | **Risk**: Medium

```json
{
  "name": "fisher-quality-growth",
  "config": {
    "minSalesCAGR3Y": 0.10,       // Minimum 10% sales growth
    "minGrossMargin": 0.45,       // Minimum 45% gross margin
    "minROIC": 0.10,              // Minimum 10% ROIC
    "minRNDIntensity": 0.05,      // Minimum 5% R&D intensity
    "minOpMargin": 0.12,          // Minimum 12% operating margin
    "improvingMargins": true,     // Require improving margins
    "maxDebtToEquity": 1.0,       // Maximum debt/equity ratio
    "minFreeCashFlowMargin": 0.05, // Minimum FCF margin
    "minScoreToBuy": 0.65,        // Minimum quality score
    "breakoutLookback": 252,      // 52-week high lookback
    "baseSMA": 200,               // Base trend filter
    "pullbackSMA": 50,            // Pullback reference
    "minVolBoost": 1.3,           // Volume boost on breakout
    "addOnPullback": true,        // Allow adding on pullbacks
    "positionSizing": {
      "type": "volatility",       // Position sizing method
      "fixedUSD": 10000,          // Fixed USD amount
      "atrLookback": 20,          // ATR lookback period
      "atrRiskUSD": 1000          // Risk per ATR unit
    },
    "riskManagement": {
      "maxPositionSize": 25000,
      "stopLossPercent": 0.12,    // Wider stops for growth stocks
      "takeProfitPercent": null   // Let winners run
    },
    "weights": {                  // Quality scoring weights
      "growth": 0.25,
      "profitability": 0.30,
      "balance_sheet": 0.20,
      "management": 0.15,
      "scuttlebutt": 0.10
    }
  }
}
```

### 7. **Graham Defensive Strategy**
**File**: `strategies/graham-defensive-strategy.js`
**Type**: Value/Defensive | **Risk**: Conservative

```json
{
  "name": "graham-defensive",
  "config": {
    "minMarketCapUSD": 2000000000, // Minimum $2B market cap
    "minCurrentRatio": 1.5,        // Minimum current ratio
    "maxDebtToEquity": 0.5,        // Maximum debt/equity
    "minYearsPositiveEPS": 10,     // Years of positive earnings
    "minYearsDividends": 10,       // Years of dividend payments
    "minEarningsGrowth10Y": 0.30,  // 10-year earnings growth
    "maxPE": 15,                   // Maximum P/E ratio
    "maxPB": 1.5,                  // Maximum P/B ratio
    "sellPE": 20,                  // Sell P/E threshold
    "sellPB": 2.5,                 // Sell P/B threshold
    "baseSMA": 200,                // Trend filter
    "rebalanceEveryDays": 365,     // Annual rebalancing
    "positionSizing": {
      "type": "fixed",             // Fixed position sizing
      "fixedUSD": 5000             // Fixed USD amount
    },
    "riskManagement": {
      "maxPositionSize": 20000,
      "stopLossPercent": 0.10,     // Optional 10% disaster stop
      "takeProfitPercent": null
    }
  }
}
```

### 8. **Graham Net-Net Strategy**
**File**: `strategies/graham-netnet-strategy.js`
**Type**: Deep Value | **Risk**: High

```json
{
  "name": "graham-netnet",
  "config": {
    "maxPositionSize": 5000,       // Small diversified positions
    "minAvgDollarVolume": 200000,  // Minimum liquidity
    "buyPtoNCAV": 0.67,           // Buy at 67% of NCAV
    "sellPtoNCAV": 1.0,           // Sell at 100% of NCAV
    "requirePositiveOCF": true,    // Require positive cash flow
    "excludeFinancials": true,     // Exclude financial sector
    "excludeDistress": true,       // Exclude distressed companies
    "riskManagement": {
      "maxPositionSize": 5000,
      "stopLossPercent": 0.25,     // 25% disaster stop
      "takeProfitPercent": null
    }
  }
}
```

### 9. **Random Walk Passive Strategy**
**File**: `strategies/random-walk-passive-strategy.js`
**Type**: Passive/Rebalancing | **Risk**: Low

```json
{
  "name": "random-walk-passive",
  "config": {
    "targetWeight": 0.6,           // Target portfolio weight
    "rebalanceBand": 0.05,         // Rebalance band (±5%)
    "minRebalanceDays": 30,        // Minimum days between rebalances
    "rebalanceEveryDays": 90,      // Calendar rebalancing (quarterly)
    "dcaContributionUSD": 0,       // Dollar-cost averaging amount
    "dcaEveryDays": 30,            // DCA frequency
    "glidePath": {
      "enabled": false             // Age-based allocation adjustment
    },
    "riskManagement": {
      "maxPositionSize": 1000000,  // Effectively unlimited
      "allowShort": false          // Long-only
    }
  }
}
```

### 10. **RSI2 Mean Reversion Strategy**
**File**: `strategies/rsi2-mean-reversion-strategy.js`
**Type**: Mean Reversion | **Risk**: Medium

```json
{
  "name": "rsi2-mean-reversion",
  "config": {
    "baseSMA": 200,               // Base trend filter
    "fastSMA": 20,                // Fast exit reference
    "rsiLen": 2,                  // Short RSI period
    "buyLevel": 10,               // RSI buy threshold
    "sellLevel": 80,              // RSI sell threshold
    "riskPerTradeUSD": 1000,      // Risk per trade
    "allowShort": false,          // Long-only strategy
    "atrLen": 14,                 // ATR calculation period
    "riskManagement": {
      "maxPositionSize": 10000,
      "stopLossPercent": 0.03,    // 3% stop loss
      "takeProfitPercent": null
    }
  }
}
```

### 11. **Volatility Target Trend Strategy**
**File**: `strategies/voltarget-trend-strategy.js`
**Type**: Volatility Targeting | **Risk**: Medium

```json
{
  "name": "voltarget-trend",
  "config": {
    "fast": 50,                   // Fast moving average
    "slow": 200,                  // Slow moving average
    "volLookback": 20,            // Volatility calculation period
    "targetVol": 0.15,            // Target 15% annualized volatility
    "maxLeverage": 2.0,           // Maximum leverage allowed
    "riskManagement": {
      "maxPositionSize": 50000,
      "stopLossPercent": 0.05,    // 5% stop loss
      "takeProfitPercent": null
    }
  }
}
```

### 12. **Force Index Strategy**
**File**: `strategies/force-index-strategy.js`
**Type**: Volume-Price | **Risk**: Medium

```json
{
  "name": "force-index",
  "config": {
    "emaLenTrend": 22,            // Trend EMA length
    "fiLen": 2,                   // Force Index smoothing
    "fiSignal": 13,               // Signal line smoothing
    "atrLen": 14,                 // ATR calculation period
    "riskPerTradeUSD": 1000,      // Risk per trade
    "riskManagement": {
      "maxPositionSize": 15000,
      "stopLossPercent": 0.03,    // 3% stop loss
      "takeProfitPercent": null
    }
  }
}
```

## 🌐 **Global Configuration**

```json
{
  "global": {
    "maxConcurrentStrategies": 3,  // Maximum strategies running simultaneously
    "riskAllocation": {
      "conservative": 0.3,         // Allocation to conservative strategies
      "moderate": 0.5,             // Allocation to moderate risk strategies
      "aggressive": 0.2            // Allocation to aggressive strategies
    },
    "consolidation": {
      "method": "weighted_voting", // Signal consolidation method
      "minimumConsensus": 0.6,     // Minimum consensus for action
      "conflictResolution": "strongest_signal" // How to resolve conflicts
    },
    "performance": {
      "trackingEnabled": true,     // Enable performance tracking
      "metricsRetention": 30,      // Days to retain metrics
      "benchmarkSymbol": "SPY"     // Benchmark for comparison
    }
  }
}
```

## 🎛️ **Managing Configurations**

### **Enabling a Strategy**
Move a strategy from `available` to `enabled` and set `enabled: true`:

```bash
npm run strategy-manager attach fisher-quality-growth
```

### **Disabling a Strategy**
```bash
npm run strategy-manager detach fisher-quality-growth
```

### **Modifying Parameters**
Edit the configuration in `config/strategies.json` and restart the strategy manager:

```json
{
  "name": "momentum",
  "config": {
    "momentum": {
      "thresholdPercentage": 7.0  // Changed from 5.0 to 7.0
    }
  }
}
```

## ⚙️ **Common Configuration Patterns**

### **Conservative Portfolio**
- Enable: `graham-defensive`, `mean-reversion`, `random-walk-passive`
- Lower position sizes, tighter risk management

### **Aggressive Growth**
- Enable: `momentum`, `donchian-breakout`, `fisher-quality-growth`
- Higher position sizes, wider stops

### **Balanced Approach**
- Enable: `momentum`, `mean-reversion`, `wyckoff-v2`
- Mixed risk levels and timeframes

### **Value Investing**
- Enable: `graham-defensive`, `graham-netnet`, `fisher-quality-growth`
- Focus on fundamental analysis

## 🔧 **Custom Configuration Tips**

1. **Start Small**: Begin with lower position sizes and allocations
2. **Test First**: Use `npm run strategy-test` before live trading
3. **Monitor Performance**: Regular review of strategy metrics
4. **Adjust Gradually**: Make incremental parameter changes
5. **Diversify**: Use complementary strategies (momentum + mean reversion)
6. **Risk Management**: Always set appropriate stop losses and position limits

## 📊 **Configuration Validation**

The system validates configurations on startup:
- Required parameters are present
- Values are within reasonable ranges
- Risk management settings are configured
- No conflicting settings exist

## 🚨 **Important Notes**

- **Paper Trading**: Always test configurations with paper trading first
- **Risk Limits**: Never exceed your risk tolerance
- **Market Conditions**: Adjust strategies based on market environment
- **Regular Review**: Monitor and adjust configurations regularly
- **Backup**: Keep backup copies of working configurations

---

**💡 Pro Tip**: Start with the default configurations and make small adjustments based on your risk tolerance and market observations. Each strategy has been configured with reasonable defaults based on academic research and practical experience.
