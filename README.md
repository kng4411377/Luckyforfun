# 🚀 Interactive Brokers Trading SDK & Automation Platform

A comprehensive Node.js SDK for Interactive Brokers Client Portal API with advanced modular trading strategies, automated execution, and professional risk management.

## ✨ **What Makes This Special**

🎯 **Modular Strategy Architecture** - Plug & play trading strategies  
🤖 **Full Automation** - Hands-free trading with advanced risk management  
📊 **Multi-Strategy Trading** - Run multiple strategies simultaneously  
🔧 **Easy Integration** - Simple API for custom strategy development  
⚡ **Real-time Execution** - Low-latency order management  
🛡️ **Professional Risk Management** - Position sizing, stops, limits  

## 🎮 **Quick Start**

### 1. **Basic Market Data**
```javascript
import { createMarketDataClient } from './src/index.js';

const client = createMarketDataClient();
const price = await client.getStockPrice('AAPL');
console.log(`AAPL: $${price.lastPrice}`);
```

### 2. **Strategy Management**
```bash
# Interactive strategy manager
npm run strategy-manager

# Available commands:
# - list-available    (show all strategies)
# - attach momentum   (attach momentum strategy)
# - detach momentum   (detach strategy)
# - performance       (show metrics)
# - health           (system health check)
```

### 3. **Automated Trading**
```bash
# Start the trading bot
npm run trading-bot

# Test strategies (no real trades)
npm run strategy-test

# Run backtests
npm run backtest
```

## 📋 **Available Strategies**

| Strategy                  | Type                      | Risk Level   | Description                        |
| ------------------------- | ------------------------- | ------------ | ---------------------------------- |
| **Momentum**              | Trend Following           | Medium       | Multi-indicator momentum detection |
| **Mean Reversion**        | Contrarian                | Conservative | Bollinger Band mean reversion      |
| **Wyckoff V2**            | Accumulation/Distribution | Medium       | Wyckoff method implementation      |
| **Elder Triple Screen**   | Multi-Timeframe           | Medium       | Alexander Elder's system           |
| **Donchian Breakout**     | Breakout                  | High         | Channel breakout system            |
| **Fisher Quality Growth** | Growth                    | Medium       | Quality growth stock selection     |
| **Graham Defensive**      | Value                     | Conservative | Benjamin Graham criteria           |

## 🎯 **Core Features**

### **SDK Capabilities**
- ✅ Real-time market data
- ✅ All order types (Market, Limit, Stop, Bracket)
- ✅ Position management
- ✅ Account information
- ✅ Rate limiting & error handling

### **Strategy System**
- ✅ Modular plugin architecture
- ✅ Dynamic attach/detach
- ✅ Signal consolidation
- ✅ Performance tracking
- ✅ Health monitoring

### **Risk Management**
- ✅ Position sizing algorithms
- ✅ Stop-loss & take-profit
- ✅ Daily loss limits
- ✅ Maximum position limits
- ✅ Volatility-based sizing

### **Automation**
- ✅ Cron-scheduled execution
- ✅ Trading hours compliance
- ✅ Multi-strategy coordination
- ✅ Real-time monitoring
- ✅ Graceful error handling

## 📚 **Documentation**

- 📖 [**Complete SDK Documentation**](docs/README.md) - Full API reference
- 🤖 [**Trading Bot Guide**](docs/TRADING.md) - Automation setup
- 📊 [**Strategy Development**](docs/strategies/) - Create custom strategies
- ⚙️ [**Configuration Guide**](config/) - Setup and configuration

## 🛠 **Installation & Setup**

### **Prerequisites**
- Node.js 16.0.0+
- Interactive Brokers account (paper trading recommended)
- IB Gateway or TWS running locally

### **Installation**
```bash
git clone <repository-url>
cd ib-trading-sdk
npm install
```

### **Configuration**
```bash
# Copy environment template
cp env.example .env

# Edit configuration
nano .env
nano config/strategies.json
```

### **Test Connection**
```bash
npm test
```

## 🎪 **Example Usage**

### **Manual Trading**
```javascript
import { createOrderClient } from './src/index.js';

const client = createOrderClient();

// Place bracket order
const order = await client.placeBracketOrder(
    'AAPL', 'BUY', 100,
    { orderType: 'MKT' },      // Entry
    { price: 160.00 },         // Profit target  
    { price: 140.00 }          // Stop loss
);
```

### **Strategy Development**
```javascript
import { BaseStrategy } from './src/base-strategy.js';

export class MyStrategy extends BaseStrategy {
    constructor(config) {
        super('my-strategy', config);
    }
    
    analyze(symbol, marketData) {
        // Your analysis logic
        return { 
            signal: 'BUY', 
            strength: 75, 
            reason: 'Custom signal detected' 
        };
    }
    
    // Implement required methods...
}
```

## 📊 **NPM Scripts**

| Script                     | Purpose                         |
| -------------------------- | ------------------------------- |
| `npm start`                | Basic SDK usage example         |
| `npm test`                 | Test IB Gateway connection      |
| `npm run trading-bot`      | Start automated trading         |
| `npm run strategy-manager` | Interactive strategy management |
| `npm run strategy-test`    | Test strategies (no trades)     |
| `npm run backtest`         | Run historical backtests        |
| `npm run market-data`      | Market data examples            |
| `npm run orders`           | Order management examples       |

## ⚠️ **Important Notes**

- **Paper Trading**: Always test with paper trading first
- **Risk Management**: Never risk more than you can afford to lose
- **Rate Limits**: SDK respects IB API rate limits (1-5 req/sec)
- **SSL**: Disable SSL verification for local IB Gateway
- **Authentication**: Requires active IB Gateway session

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Add your strategy or improvement
4. Test thoroughly with paper trading
5. Submit a pull request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- 📖 Check [documentation](docs/)
- 🐛 Report issues via GitHub
- 💬 Join discussions in Issues section

---

**⚡ Built for algorithmic traders who demand flexibility, reliability, and professional-grade risk management.**

🎯 **Perfect for**: Quantitative analysts, algorithmic traders, strategy researchers, and trading system developers.
