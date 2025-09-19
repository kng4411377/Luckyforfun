# 📊 Trading Strategies Overview

This document provides an overview of all available trading strategies in the SDK.

## 🎯 **Active Strategies** (Currently Enabled)

### 1. **Momentum Strategy** 
- **File**: `src/momentum-strategy.js`
- **Type**: Trend Following
- **Risk Level**: Medium
- **Timeframe**: 5 minutes
- **Description**: Multi-indicator momentum detection using RSI, Moving Averages, Bollinger Bands, and volume analysis
- **Key Features**:
  - Momentum threshold detection (5% default)
  - RSI overbought/oversold signals
  - Moving average crossovers
  - Volume confirmation
  - Dynamic position sizing based on volatility

### 2. **Mean Reversion Strategy**
- **File**: `strategies/mean-reversion-strategy.js`
- **Type**: Contrarian
- **Risk Level**: Conservative
- **Timeframe**: 15 minutes
- **Description**: Bollinger Band mean reversion with RSI confirmation
- **Key Features**:
  - Bollinger Band breakout detection
  - RSI oversold/overbought confirmation
  - Price distance from SMA validation
  - Smaller position sizes for conservative approach
  - Exits when price returns to band middle

## 🔧 **Available Strategies** (Can be Enabled)

### 3. **Wyckoff V2 Strategy**
- **File**: `strategies/wyckoff-v2-strategy.js`
- **Type**: Accumulation/Distribution
- **Risk Level**: Medium
- **Description**: Simplified Wyckoff method with range detection, spring, and SOS breakout
- **Key Features**:
  - Range detection with flat tolerance
  - Spring identification (false breakdowns)
  - Sign of Strength (SOS) breakout signals
  - State machine implementation

### 4. **Elder Triple Screen Strategy**
- **File**: `strategies/elder-triple-screen-strategy.js`
- **Type**: Multi-Timeframe
- **Risk Level**: Medium
- **Description**: Alexander Elder's Triple Screen system with MACD trend filter and RSI entry
- **Key Features**:
  - Weekly MACD-Histogram trend filter
  - Daily RSI(2) pullback entries
  - ATR-based position sizing
  - Multi-timeframe coordination

### 5. **Donchian Breakout Strategy**
- **File**: `strategies/donchian-breakout-strategy.js`
- **Type**: Breakout/Trend Following
- **Risk Level**: High
- **Description**: Channel breakout system based on Donchian channels
- **Key Features**:
  - 55-day entry channel
  - 20-day exit channel
  - ATR-based risk management
  - Pyramiding capabilities

### 6. **Fisher Quality Growth Strategy**
- **File**: `strategies/fisher-quality-growth-strategy.js`
- **Type**: Growth/Quality
- **Risk Level**: Medium
- **Description**: Philip Fisher inspired quality growth stock selection
- **Key Features**:
  - Fundamental quality metrics
  - Growth rate requirements
  - Technical breakout confirmation
  - Volatility-based position sizing

### 7. **Graham Defensive Strategy**
- **File**: `strategies/graham-defensive-strategy.js`
- **Type**: Value/Defensive
- **Risk Level**: Conservative
- **Description**: Benjamin Graham defensive investor criteria
- **Key Features**:
  - Strict valuation metrics (P/E, P/B)
  - Financial strength requirements
  - Dividend history validation
  - Conservative position sizing

## 🧪 **Experimental Strategies**

### 8. **Graham Net-Net Strategy**
- **File**: `strategies/graham-netnet-strategy.js`
- **Status**: Disabled by default
- **Type**: Deep Value
- **Description**: Net current asset value investing

### 9. **Random Walk Passive Strategy**
- **File**: `strategies/random-walk-passive-strategy.js`
- **Status**: Experimental
- **Type**: Passive/Rebalancing
- **Description**: Dollar-cost averaging with rebalancing

### 10. **RSI2 Mean Reversion Strategy**
- **File**: `strategies/rsi2-mean-reversion-strategy.js`
- **Status**: Experimental
- **Type**: Mean Reversion
- **Description**: Short-term RSI(2) mean reversion

### 11. **Volatility Target Trend Strategy**
- **File**: `strategies/voltarget-trend-strategy.js`
- **Status**: Experimental
- **Type**: Volatility Targeting
- **Description**: Trend following with volatility targeting

### 12. **Force Index Strategy**
- **File**: `strategies/force-index-strategy.js`
- **Status**: Experimental
- **Type**: Volume-Price
- **Description**: Elder's Force Index indicator strategy

## 🎛️ **Strategy Management**

### **Enabling/Disabling Strategies**
```bash
# Interactive management
npm run strategy-manager

# Command line
npm run attach-strategy momentum
npm run detach-strategy momentum
```

### **Configuration**
Edit `config/strategies.json` to modify strategy parameters:

```json
{
  "enabled": [
    {
      "name": "momentum",
      "config": {
        "enabled": true,
        "priority": 1,
        "allocation": 0.3,
        "momentum": {
          "lookbackDays": 20,
          "thresholdPercentage": 5.0
        }
      }
    }
  ]
}
```

### **Performance Monitoring**
```bash
# View strategy performance
npm run strategy-manager performance

# Health check
npm run strategy-manager health
```

## 🔧 **Creating Custom Strategies**

### **1. Extend BaseStrategy**
```javascript
import { BaseStrategy } from '../src/base-strategy.js';

export class MyCustomStrategy extends BaseStrategy {
    constructor(config) {
        super('my-custom', config);
        
        this.metadata = {
            version: '1.0.0',
            author: 'Your Name',
            description: 'Custom strategy description',
            timeframe: '5m',
            riskLevel: 'medium'
        };
    }
    
    // Implement required methods
    analyze(symbol, marketData) { /* ... */ }
    calculatePositionSize(symbol, price, accountValue) { /* ... */ }
    calculateExitLevels(signal, entryPrice) { /* ... */ }
    checkExitSignal(symbol, position, marketData) { /* ... */ }
}
```

### **2. Save to strategies/ folder**
```bash
# File: strategies/my-custom-strategy.js
export default MyCustomStrategy;
```

### **3. Auto-discovery**
The strategy manager will automatically discover your new strategy!

## 📈 **Strategy Performance Metrics**

Each strategy tracks:
- **Total Signals**: Number of signals generated
- **Total Trades**: Number of executed trades
- **Active Positions**: Current open positions
- **Win Rate**: Percentage of winning trades
- **Profit Factor**: Gross profit / Gross loss
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Largest peak-to-trough decline

## 🛡️ **Risk Management**

All strategies implement:
- **Position Sizing**: Based on account value and volatility
- **Stop Loss**: Automatic stop-loss orders
- **Take Profit**: Profit-taking levels
- **Daily Loss Limits**: Maximum daily loss protection
- **Position Limits**: Maximum concurrent positions
- **Volatility Adjustment**: Position size based on volatility

## 🎯 **Strategy Selection Guide**

| Market Condition | Recommended Strategies |
|------------------|----------------------|
| **Strong Trends** | Momentum, Donchian Breakout |
| **Range-bound** | Mean Reversion, Wyckoff V2 |
| **High Volatility** | Mean Reversion (smaller sizes) |
| **Low Volatility** | Momentum, Breakout |
| **Bear Market** | Mean Reversion, Graham Defensive |
| **Bull Market** | Momentum, Fisher Growth |

## 📚 **Further Reading**

- [Individual Strategy Documentation](strategies/)
- [Trading Bot Setup](TRADING.md)
- [SDK API Reference](README.md)
- [Configuration Guide](../config/)

---

**💡 Pro Tip**: Start with 1-2 complementary strategies (e.g., Momentum + Mean Reversion) before adding more complex combinations.
