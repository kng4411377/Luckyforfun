# Interactive Brokers Client Portal SDK for Node.js

A comprehensive Node.js SDK for connecting to Interactive Brokers Client Portal API, designed for paper trading and market data retrieval with proper rate limiting and error handling.

## 🚀 Features

- **Easy Authentication**: Seamless connection to IB Gateway/TWS
- **Stock Price Queries**: Real-time and snapshot market data retrieval
- **Order Management**: Complete order placement and management system
- **All Order Types**: Market, Limit, Stop, Stop-Limit, Trailing Stop orders
- **Bracket Orders**: Advanced bracket orders with profit targets and stop losses
- **Rate Limiting**: Built-in 1 req/sec rate limiting (configurable up to 5 req/sec)
- **Paper Trading Ready**: Optimized for paper trading accounts
- **Error Handling**: Comprehensive error handling with custom exceptions
- **TypeScript Ready**: Full JSDoc documentation for excellent IDE support
- **Lightweight**: Minimal dependencies (only axios)

## 📋 Prerequisites

Before using this SDK, you need:

1. **Interactive Brokers Account**: Paper trading or live account
2. **IB Gateway or TWS**: Running locally on your machine
3. **API Access**: Enabled in your IB Gateway/TWS settings
4. **Node.js**: Version 16.0.0 or higher

## 🛠 Installation

```bash
# Clone or download this SDK
cd ib-client-portal-sdk

# Install dependencies
npm install

# Test the connection
npm test
```

## ⚙️ Setup IB Gateway

1. **Download IB Gateway** from Interactive Brokers
2. **Install and Launch** IB Gateway
3. **Login** with your paper trading credentials
4. **Configure API Settings**:
   - Enable API connections
   - Set port to 5000 (default)
   - Allow localhost connections
   - Disable "Read-Only API"

## 🎯 Quick Start

### Basic Usage

```javascript
import { createMarketDataClient, createOrderClient } from './src/index.js';

// Market data
const marketClient = createMarketDataClient({
    host: '127.0.0.1',
    port: 5000,
    rateLimit: 1.0 // 1 request per second
});

// Get stock price
const price = await marketClient.getStockPrice('AAPL');
console.log('AAPL Price:', price.lastPrice);

// Order management
const orderClient = createOrderClient();

// Place a market order
const order = await orderClient.placeMarketOrder('AAPL', 'BUY', 100);
console.log('Order placed:', order);

// Place a bracket order
const bracket = await orderClient.placeBracketOrder(
    'AAPL', 'BUY', 100,
    { orderType: 'MKT' },     // Parent order
    { price: 160.00 },        // Profit target
    { price: 140.00 }         // Stop loss
);
```

### Authentication Check

```javascript
import { createClient } from './src/index.js';

const client = createClient();

// Check if authenticated
const authStatus = await client.getAuthStatus();
if (authStatus.authenticated) {
    console.log('✅ Authenticated');
    
    // Get accounts
    const accounts = await client.getAccounts();
    console.log('Available accounts:', accounts);
} else {
    console.log('❌ Please login to IB Gateway first');
}
```

## 📚 API Reference

### OrderClient

The main class for order management and trading.

#### Order Types

```javascript
import { OrderTypes, OrderSides, TimeInForce } from './src/index.js';

// Order types
OrderTypes.MARKET          // Market order
OrderTypes.LIMIT           // Limit order  
OrderTypes.STOP            // Stop order
OrderTypes.STOP_LIMIT      // Stop-limit order
OrderTypes.TRAILING_STOP   // Trailing stop order

// Order sides
OrderSides.BUY             // Buy order
OrderSides.SELL            // Sell order

// Time in force
TimeInForce.DAY            // Day order
TimeInForce.GOOD_TILL_CANCEL // GTC order
TimeInForce.IMMEDIATE_OR_CANCEL // IOC order
TimeInForce.FILL_OR_KILL   // FOK order
```

#### Methods

##### `placeMarketOrder(symbol, side, quantity, options)`
Place a market order for immediate execution.

```javascript
const order = await orderClient.placeMarketOrder('AAPL', 'BUY', 100, {
    timeInForce: 'DAY'
});
```

##### `placeLimitOrder(symbol, side, quantity, price, options)`
Place a limit order at a specific price.

```javascript
const order = await orderClient.placeLimitOrder('AAPL', 'BUY', 100, 150.00, {
    timeInForce: 'GTC'
});
```

##### `placeStopOrder(symbol, side, quantity, stopPrice, options)`
Place a stop order (stop-loss or stop-buy).

```javascript
const order = await orderClient.placeStopOrder('AAPL', 'SELL', 100, 140.00);
```

##### `placeStopLimitOrder(symbol, side, quantity, stopPrice, limitPrice, options)`
Place a stop-limit order.

```javascript
const order = await orderClient.placeStopLimitOrder('AAPL', 'SELL', 100, 140.00, 139.50);
```

##### `placeTrailingStopOrder(symbol, side, quantity, trailAmount, options)`
Place a trailing stop order.

```javascript
// Trail by $2.00
const order1 = await orderClient.placeTrailingStopOrder('AAPL', 'SELL', 100, 2.00);

// Trail by 2%
const order2 = await orderClient.placeTrailingStopOrder('AAPL', 'SELL', 100, 2, {
    isPercentage: true
});
```

##### `placeBracketOrder(symbol, side, quantity, parentOrder, profitTarget, stopLoss, options)`
Place a bracket order with profit target and stop loss.

```javascript
// Market bracket order
const bracket = await orderClient.placeBracketOrder(
    'AAPL', 'BUY', 100,
    { orderType: 'MKT' },
    { price: 160.00 },  // Profit target
    { price: 140.00 }   // Stop loss
);

// Limit bracket order
const bracket = await orderClient.placeBracketOrder(
    'AAPL', 'BUY', 100,
    { orderType: 'LMT', price: 150.00 },
    { price: 160.00 },  // Profit target
    { price: 140.00 }   // Stop loss
);
```

##### `getLiveOrders(accountId)`
Get all live orders for the account.

```javascript
const orders = await orderClient.getLiveOrders();
console.log('Live orders:', orders.length);
```

##### `cancelOrder(orderId, accountId)`
Cancel a specific order.

```javascript
const result = await orderClient.cancelOrder('12345');
```

##### `modifyOrder(orderId, modifications, accountId)`
Modify an existing order.

```javascript
const result = await orderClient.modifyOrder('12345', {
    quantity: 200,
    price: 155.00
});
```

##### `getExecutions(accountId, days)`
Get recent trade executions.

```javascript
const executions = await orderClient.getExecutions(null, 7); // Last 7 days
```

### MarketDataClient

The main class for retrieving market data.

#### Methods

##### `getStockPrice(symbol)`
Get current price information for a single stock.

```javascript
const price = await client.getStockPrice('AAPL');
console.log({
    lastPrice: price.lastPrice,
    bid: price.bid,
    ask: price.ask,
    volume: price.volume,
    change: price.change,
    changePercent: price.changePercent
});
```

##### `getMultipleStockPrices(symbols)`
Get prices for multiple stocks efficiently.

```javascript
const prices = await client.getMultipleStockPrices(['AAPL', 'MSFT', 'GOOGL']);
for (const [symbol, data] of Object.entries(prices)) {
    console.log(`${symbol}: $${data.lastPrice}`);
}
```

##### `getMarketDataSnapshot(symbols, fields)`
Get market data with custom field selection.

```javascript
// Custom fields: bid, ask, last, volume, high, low
const fields = ['31', '84', '86', '87', '70', '71'];
const data = await client.getMarketDataSnapshot('AAPL', fields);
```

##### `searchSymbol(symbol)`
Search for contracts matching a symbol.

```javascript
const contracts = await client.searchSymbol('AAPL');
console.log('Found contracts:', contracts.length);
```

##### `getContractDetails(symbol)`
Get detailed contract information.

```javascript
const details = await client.getContractDetails('AAPL');
console.log('Company:', details.companyName);
console.log('Industry:', details.industry);
```

##### `isMarketOpen()`
Check if the market is currently open.

```javascript
const isOpen = await client.isMarketOpen();
console.log('Market is', isOpen ? 'OPEN' : 'CLOSED');
```

### IBClient

The core client for authentication and account management.

#### Methods

##### `checkHealth()`
Test connection to IB Gateway.

```javascript
const health = await client.checkHealth();
console.log('Gateway status:', health);
```

##### `getAuthStatus()`
Check authentication status.

```javascript
const auth = await client.getAuthStatus();
console.log('Authenticated:', auth.authenticated);
```

##### `getAccounts()`
Get list of available accounts.

```javascript
const accounts = await client.getAccounts();
console.log('Paper trading accounts:', 
    accounts.filter(acc => acc.accountId.startsWith('DU'))
);
```

##### `getAccountSummary(accountId)`
Get account summary information.

```javascript
const summary = await client.getAccountSummary();
console.log('Account summary:', summary);
```

## ⚡ Configuration

### Config Options

```javascript
import { Config } from './src/config.js';

const config = new Config({
    host: '127.0.0.1',        // IB Gateway host
    port: 5000,               // IB Gateway port
    rateLimit: 1.0,           // Requests per second (max 5.0)
    verifySsl: false,         // SSL verification (false for IB Gateway)
    timeout: 30000            // Request timeout in milliseconds
});
```

### Environment Variables

You can also use environment variables:

```bash
export IB_HOST=127.0.0.1
export IB_PORT=5000
```

## 🔧 Examples

Run the included examples:

```bash
# Basic usage example
npm start

# Connection test
npm test

# Advanced market data features
npm run market-data

# Order management examples
npm run orders

# Bracket orders examples
npm run brackets
```

## 📊 Market Data Fields

Common field codes for market data:

| Code | Field | Description |
|------|-------|-------------|
| 31 | bid | Current bid price |
| 84 | ask | Current ask price |
| 86 | lastPrice | Last traded price |
| 87 | volume | Trading volume |
| 82 | change | Price change |
| 83 | changePercent | Percentage change |
| 70 | high | Day's high price |
| 71 | low | Day's low price |

## 🚨 Error Handling

The SDK provides specific error types:

```javascript
import { 
    ConnectionError, 
    AuthenticationError, 
    InvalidSymbolError,
    RateLimitError 
} from './src/index.js';

try {
    // Market data
    const price = await marketClient.getStockPrice('INVALID');
    
    // Order placement
    const order = await orderClient.placeMarketOrder('AAPL', 'BUY', 100);
    
} catch (error) {
    if (error instanceof InvalidSymbolError) {
        console.log('Invalid symbol provided');
    } else if (error instanceof ConnectionError) {
        console.log('Cannot connect to IB Gateway');
    } else if (error instanceof AuthenticationError) {
        console.log('Please login to IB Gateway');
    } else if (error instanceof RateLimitError) {
        console.log('Rate limit exceeded');
    }
}
```

## ⚠️ Important Notes

### Rate Limiting
- Default: 1 request per second
- Maximum: 5 requests per second per endpoint
- Automatically enforced by the SDK

### Paper Trading
- Use paper trading accounts (starting with "DU")
- Perfect for testing and development
- No real money at risk
- All order types supported in paper trading

### Order Management
- All basic order types supported (Market, Limit, Stop, Stop-Limit, Trailing Stop)
- Advanced bracket orders with profit targets and stop losses
- Real-time order monitoring and modification
- Order cancellation and status tracking

### SSL Certificates
- IB Gateway uses self-signed certificates
- SSL verification is disabled by default
- This is normal and expected

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5000
```
- Make sure IB Gateway is running
- Check the port number (default: 5000)
- Verify API connections are enabled

**Authentication Failed**
```
Error: Authentication required or expired
```
- Login to IB Gateway with your credentials
- Make sure you're using paper trading account
- Check that API access is enabled

**Invalid Symbol**
```
Error: No contracts found for symbol: XYZ
```
- Verify the stock symbol is correct
- Some symbols may not be available
- Try searching with `searchSymbol()` first

**Rate Limit Exceeded**
```
Error: Rate limit exceeded
```
- The SDK automatically handles rate limiting
- If you see this, you may be making requests too quickly
- Consider increasing the delay between requests

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📊 Project Stats

- **Total Files**: 11 source files + 5 examples
- **Dependencies**: Minimal (only axios + https)
- **Node.js**: 16.0.0+ required
- **License**: MIT
- **API Coverage**: Market Data + Complete Order Management
- **Order Types**: 5 basic types + Bracket orders
- **Examples**: 5 comprehensive examples

## 🎯 SDK Capabilities Summary

| Feature             | Status     | Description                         |
| ------------------- | ---------- | ----------------------------------- |
| 🔐 Authentication    | ✅ Complete | IB Gateway session management       |
| 📊 Market Data       | ✅ Complete | Real-time prices, snapshots, search |
| 📋 Market Orders     | ✅ Complete | Immediate execution orders          |
| 💰 Limit Orders      | ✅ Complete | Price-specific orders               |
| 🛑 Stop Orders       | ✅ Complete | Stop-loss and stop-buy orders       |
| 🎯 Stop-Limit Orders | ✅ Complete | Combined stop + limit orders        |
| 📈 Trailing Stops    | ✅ Complete | Dynamic stops ($ or %)              |
| 🎪 Bracket Orders    | ✅ Complete | Parent + profit + stop orders       |
| 👀 Order Monitoring  | ✅ Complete | Live orders, status, history        |
| ✏️ Order Management  | ✅ Complete | Modify, cancel, track orders        |
| ⚡ Rate Limiting     | ✅ Complete | 1-5 req/sec with auto-throttling    |
| 🛡️ Error Handling    | ✅ Complete | Custom exceptions for all scenarios |
| 📚 Documentation     | ✅ Complete | Full API docs + examples            |

## 📞 Support

- **IB API Documentation**: [Interactive Brokers API Docs](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/)
- **Issues**: Open an issue on GitHub
- **IB Support**: Contact Interactive Brokers for account-related issues

## 🔗 Related Links

- [Interactive Brokers](https://www.interactivebrokers.com/)
- [IB Gateway Download](https://www.interactivebrokers.com/en/trading/ib-api.php)
- [Paper Trading Guide](https://www.interactivebrokers.com/en/trading/free-trial.php)

## 🏆 What Makes This SDK Special

- **🎯 Paper Trading First**: Designed specifically for safe paper trading
- **📋 Complete Order Types**: All essential order types in one package
- **🎪 Advanced Features**: Bracket orders with profit targets and stops
- **⚡ Performance Optimized**: Rate limiting, caching, and efficient API usage
- **🛡️ Safety Focused**: Comprehensive error handling and input validation
- **📚 Well Documented**: Extensive examples and clear API documentation
- **🔧 Easy to Use**: Simple, intuitive API design
- **🚀 Production Ready**: Robust, tested, and reliable

---

**Ready to start algorithmic trading with Interactive Brokers? Get started in minutes! 🚀📈**
