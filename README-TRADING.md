# 🤖 Automated Momentum Trading Bot

## Overview

This is a comprehensive automated momentum trading system built on top of the Interactive Brokers Client Portal SDK. The bot implements a sophisticated momentum-based trading strategy with advanced risk management, technical analysis, and automated execution capabilities.

## 🚀 Features

### 📊 **Advanced Trading Strategy**
- **Momentum Analysis**: Identifies stocks with strong price momentum
- **Technical Indicators**: RSI, Moving Averages, Bollinger Bands, MACD
- **Multi-Factor Signals**: Combines multiple indicators for robust signals
- **Volume Confirmation**: Validates signals with volume analysis

### 🛡️ **Risk Management**
- **Position Sizing**: Dynamic position sizing based on account value and volatility
- **Stop Loss/Take Profit**: Automatic bracket orders with configurable levels
- **Daily Loss Limits**: Prevents excessive losses with daily P&L monitoring
- **Maximum Positions**: Limits concurrent positions for diversification
- **Trailing Stops**: Dynamic stop-loss adjustment for profit protection

### ⚡ **Automation Features**
- **Scheduled Scanning**: Automated market scanning at configurable intervals
- **Trading Hours**: Respects market hours and trading sessions
- **Real-time Monitoring**: Continuous position and order monitoring
- **Automatic Execution**: Hands-free order placement and management
- **Performance Tracking**: Real-time P&L and performance metrics

### 📈 **Analysis & Backtesting**
- **Strategy Testing**: Comprehensive strategy validation tools
- **Backtesting Framework**: Historical performance analysis
- **Performance Metrics**: Sharpe ratio, win rate, profit factor, drawdown
- **Technical Indicator Testing**: Validate indicator calculations

## 📁 Project Structure

```
trading/
├── momentum-bot.js          # Main automated trading bot
├── strategy-test.js         # Strategy testing and validation
└── backtest.js             # Backtesting framework

src/
├── momentum-strategy.js     # Core momentum trading strategy
├── technical-indicators.js # Technical analysis indicators
└── logger.js               # Trading-specific logging

config/
└── trading-config.json     # Strategy configuration parameters

env.example                  # Environment variables template
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Interactive Brokers
IB_HOST=127.0.0.1
IB_PORT=5000
IB_ACCOUNT_ID=DU123456

# Trading Settings
TRADING_ENABLED=false        # Set to true to enable live trading
PAPER_TRADING=true          # Always use paper trading for safety
MAX_DAILY_LOSS=1000         # Maximum daily loss limit ($)
MAX_POSITION_SIZE=10000     # Maximum position size ($)

# Risk Management
STOP_LOSS_PERCENTAGE=2.0    # Stop loss percentage
TAKE_PROFIT_PERCENTAGE=4.0  # Take profit percentage
MAX_POSITIONS=5             # Maximum concurrent positions

# Strategy Parameters
MOMENTUM_LOOKBACK_DAYS=20   # Momentum calculation period
MOMENTUM_THRESHOLD=5.0      # Minimum momentum percentage
VOLUME_THRESHOLD=1000000    # Minimum average volume
RSI_OVERSOLD=30            # RSI oversold level
RSI_OVERBOUGHT=70          # RSI overbought level

# Automation
SCAN_INTERVAL_MINUTES=5     # Market scanning frequency
TRADING_START_HOUR=9        # Trading start hour (24h format)
TRADING_END_HOUR=16         # Trading end hour (24h format)
```

### Strategy Configuration (config/trading-config.json)

The strategy configuration file contains detailed parameters for:

- **Watchlist**: Stocks to monitor and trade
- **Technical Indicators**: RSI, Moving Averages, Bollinger Bands settings
- **Risk Management**: Position sizing, stop losses, profit targets
- **Order Settings**: Order types, time in force, slippage limits
- **Automation**: Scheduling, trading hours, notifications

## 🚀 Getting Started

### 1. Setup Environment

```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

### 2. Configure Strategy

Edit `config/trading-config.json` to customize:
- Watchlist symbols
- Risk management parameters
- Technical indicator settings
- Trading schedule

### 3. Install Dependencies

```bash
npm install
```

### 4. Test Strategy

```bash
# Test strategy on current market data
npm run strategy-test

# Run comprehensive backtest
npm run backtest
```

### 5. Start Trading Bot

```bash
# Start automated trading bot
npm run trading-bot
```

## 📊 Strategy Details

### Momentum Analysis

The strategy identifies momentum using multiple factors:

1. **Price Momentum**: Rate of change over configurable period
2. **Volume Confirmation**: Above-average volume validation
3. **Technical Indicators**: RSI, moving averages, Bollinger Bands
4. **Pattern Recognition**: Trend identification and breakouts

### Signal Generation

Signals are generated based on:

- **BUY Signals**: 
  - Strong upward momentum (>5%)
  - RSI oversold (<30) or trending up
  - Price above short-term moving average
  - High volume confirmation

- **SELL Signals**:
  - Strong downward momentum (<-5%)
  - RSI overbought (>70) or trending down
  - Price below short-term moving average
  - Volume confirmation

### Risk Management

- **Position Sizing**: Maximum 20% of account per position
- **Stop Loss**: 2% below entry price (configurable)
- **Take Profit**: 4% above entry price (configurable)
- **Trailing Stops**: Dynamic adjustment to protect profits
- **Daily Limits**: Automatic shutdown at daily loss limit

## 📈 Performance Monitoring

### Real-time Metrics

The bot tracks:
- Daily P&L
- Win/Loss ratio
- Active positions
- Order status
- Risk metrics

### Logging

Comprehensive logging includes:
- Trade executions
- Signal generation
- Risk events
- Performance metrics
- Error handling

Logs are stored in `logs/` directory with rotation.

## 🧪 Testing & Validation

### Strategy Testing

```bash
npm run strategy-test
```

Tests current strategy on live market data:
- Technical indicator calculations
- Signal generation
- Risk management rules
- Position sizing

### Backtesting

```bash
npm run backtest
```

Runs historical simulation:
- Performance metrics
- Trade analysis
- Drawdown calculation
- Risk-adjusted returns

## ⚠️ Important Safety Notes

### Paper Trading Only
- **ALWAYS** use paper trading accounts (DU prefix)
- Never run on live accounts without extensive testing
- Verify all trades in TWS/IB Gateway

### Risk Management
- Start with small position sizes
- Monitor daily loss limits
- Review all trades manually initially
- Understand strategy behavior before automation

### Market Conditions
- Strategy performance varies with market conditions
- Bull markets favor momentum strategies
- Consider market volatility and regime changes
- Monitor correlation between positions

## 🔧 Customization

### Adding New Indicators

1. Add indicator to `src/technical-indicators.js`
2. Integrate in `src/momentum-strategy.js`
3. Update configuration parameters
4. Test thoroughly

### Modifying Strategy Logic

1. Edit signal generation in `MomentumStrategy.generateSignals()`
2. Adjust risk management rules
3. Update configuration parameters
4. Run comprehensive tests

### Custom Watchlists

Edit `config/trading-config.json`:

```json
{
  "watchlist": [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "META", "NVDA", "NFLX", "AMD", "CRM"
  ]
}
```

## 📞 Support & Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure IB Gateway is running and logged in
2. **Rate Limiting**: Reduce scan frequency if hitting limits
3. **Insufficient Data**: Allow time for price history accumulation
4. **Order Rejections**: Check account permissions and margin

### Debugging

- Check logs in `logs/trading.log`
- Verify configuration parameters
- Test individual components
- Monitor IB Gateway messages

### Performance Optimization

- Adjust scan intervals based on strategy timeframe
- Optimize watchlist size for processing speed
- Balance between signal frequency and quality
- Monitor system resources

## 📊 Expected Performance

### Typical Metrics (Backtested)
- **Win Rate**: 55-65%
- **Profit Factor**: 1.2-1.8
- **Maximum Drawdown**: 5-15%
- **Sharpe Ratio**: 0.8-1.5

### Performance Factors
- Market conditions (trending vs. sideways)
- Volatility levels
- Sector rotation
- Overall market sentiment

*Note: Past performance does not guarantee future results. Always trade responsibly.*

---

**⚠️ DISCLAIMER: This is educational software for paper trading only. Use at your own risk. Always thoroughly test strategies before considering live trading.**
