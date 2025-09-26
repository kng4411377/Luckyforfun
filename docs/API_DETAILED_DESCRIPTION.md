# Trading Strategy Management API - Detailed Description

## 📋 Overview

The Trading Strategy Management API is a comprehensive REST API designed for managing algorithmic trading strategies and integrating with Interactive Brokers Client Portal. This API provides a unified interface for strategy configuration, account monitoring, and portfolio management.

## 🏗️ Architecture

### Core Components

1. **API Server** (`src/api-server.js`)
   - Express.js-based REST API server
   - Middleware for CORS, request logging, and error handling
   - Configurable HTTP/HTTPS support for IBKR integration

2. **IBKR Client** (`src/client.js`)
   - Interactive Brokers Client Portal integration
   - Automatic rate limiting and session management
   - Support for both HTTP and HTTPS protocols

3. **Configuration Management**
   - JSON-based strategy configuration storage
   - Real-time configuration updates
   - Validation and error handling

## 🔧 Configuration Options

### Environment Variables

```bash
# API Server Configuration
API_HOST=localhost                    # API server host
API_PORT=3000                        # API server port

# IBKR Client Portal Configuration
IB_HOST=127.0.0.1                    # IB Gateway/TWS host
IB_PORT=5000                         # IB Gateway/TWS port
IB_USE_HTTPS=false                   # Use HTTP (false) or HTTPS (true)
IB_VERIFY_SSL=false                  # SSL certificate verification
IB_RATE_LIMIT=1.0                    # Requests per second limit
```

### Programmatic Configuration

```javascript
const server = createTradingAPIServer({
    // API Server settings
    host: 'localhost',
    port: 3000,
    strategiesConfigPath: './config/strategies.json',
    
    // IBKR settings
    ibkrHost: '127.0.0.1',
    ibkrPort: 5000,
    ibkrUseHttps: false,              // HTTP for localhost
    ibkrVerifySsl: false,
    ibkrRateLimit: 1.0
});
```

## 📊 API Endpoints Detailed Analysis

### Health Check Endpoint

#### `GET /health`

**Purpose**: System health monitoring and configuration verification

**Response Analysis**:
```json
{
    "status": "healthy",                    // Server operational status
    "timestamp": "2024-01-01T12:00:00Z",   // Current server time
    "ibkrConfig": {                        // IBKR connection config
        "host": "127.0.0.1",
        "port": 5000,
        "protocol": "http"                  // Confirms HTTP/HTTPS setting
    }
}
```

**Use Cases**:
- Load balancer health checks
- Monitoring system integration
- Configuration validation
- Debugging connection issues

### Strategy Management Endpoints

#### `GET /api/strategies`

**Purpose**: Retrieve complete strategy ecosystem

**Response Structure**:
```json
{
    "enabled": [...],      // Active strategies currently running
    "available": [...],    // Inactive strategies ready for activation
    "global": {           // System-wide configuration
        "maxConcurrentStrategies": 3,
        "riskAllocation": {
            "conservative": 0.3,
            "moderate": 0.5,
            "aggressive": 0.2
        },
        "consolidation": {
            "method": "weighted_voting",
            "minimumConsensus": 0.6,
            "conflictResolution": "strongest_signal"
        }
    }
}
```

**Strategy Configuration Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Unique strategy identifier | "momentum" |
| `enabled` | boolean | Active status | true |
| `priority` | integer | Execution priority (1=highest) | 1 |
| `allocation` | float | Portfolio allocation (0.0-1.0) | 0.3 |
| `riskManagement` | object | Risk parameters | See below |
| `technicalIndicators` | object | TA parameters | See below |

**Risk Management Parameters**:
```json
{
    "maxPositions": 5,              // Max concurrent positions
    "maxPositionSize": 10000,       // Max position size (USD)
    "stopLossPercentage": 2.0,      // Stop loss threshold
    "takeProfitPercentage": 4.0,    // Take profit threshold
    "trailingStopPercentage": 1.5,  // Trailing stop distance
    "riskRewardRatio": 2.0          // Minimum risk/reward ratio
}
```

#### `PUT /api/strategies/{name}`

**Purpose**: Dynamic strategy reconfiguration

**Request Validation**:
- Complete `config` object required
- Numeric values validated for ranges
- Boolean flags properly typed
- Strategy existence verified

**Update Process**:
1. Locate strategy in enabled/available arrays
2. Validate new configuration structure
3. Apply updates atomically
4. Save to JSON file immediately
5. Return updated strategy object

**Example Request**:
```json
{
    "config": {
        "enabled": true,
        "allocation": 0.4,              // Increased from 0.3
        "momentum": {
            "lookbackDays": 30,         // Changed from 20
            "thresholdPercentage": 6.0   // Increased sensitivity
        },
        "riskManagement": {
            "maxPositions": 3,          // Reduced from 5
            "stopLossPercentage": 1.8   // Tighter stop loss
        }
    }
}
```

#### `POST /api/strategies/{name}/enable`

**Purpose**: Strategy activation workflow

**Process Flow**:
1. Verify strategy exists in `available` array
2. Check not already in `enabled` array
3. Set `config.enabled = true`
4. Move strategy object from `available` to `enabled`
5. Update configuration file
6. Return success response with strategy details

**State Transition**:
```
Available Strategy → Enabled Strategy
├── Update enabled flag
├── Move array position
├── Persist changes
└── Activate in trading system
```

### Account & Holdings Endpoints

#### `GET /api/account/holdings`

**Purpose**: Real-time portfolio position monitoring

**Data Sources**: 
- IBKR Client Portal `/portfolio/{accountId}/positions/0` endpoint
- Real-time market data integration
- Position-level P&L calculations

**Position Object Structure**:
```json
{
    "contractId": 265598,           // IBKR contract identifier
    "position": 100,                // Share quantity (+ long, - short)
    "marketPrice": 150.25,          // Current market price
    "marketValue": 15025.00,        // Position market value
    "currency": "USD",              // Currency denomination
    "avgCost": 148.50,             // Average cost basis
    "unrealizedPnl": 175.00,       // Unrealized P&L
    "symbol": "AAPL",              // Stock symbol (if available)
    "secType": "STK"               // Security type
}
```

**Calculation Logic**:
- Market Value = Position × Market Price
- Unrealized P&L = (Market Price - Avg Cost) × Position
- Percentage Gain = (Unrealized P&L / (Avg Cost × Position)) × 100

#### `GET /api/account/summary`

**Purpose**: Comprehensive account financial overview

**Key Metrics**:

| Metric | Description | Calculation |
|--------|-------------|-------------|
| NetLiquidation | Total account equity | Cash + Positions - Margin |
| TotalCashValue | Available cash | Settled cash + unsettled |
| GrossPositionValue | Total position value | Sum of all position market values |
| BuyingPower | Available purchasing power | Based on margin requirements |
| MaintMarginReq | Maintenance margin | Required margin for positions |

**Example Response**:
```json
{
    "accountId": "DU123456",
    "summary": {
        "NetLiquidation": {"value": "100000.00", "currency": "USD"},
        "TotalCashValue": {"value": "85000.00", "currency": "USD"},
        "GrossPositionValue": {"value": "15000.00", "currency": "USD"},
        "BuyingPower": {"value": "200000.00", "currency": "USD"},
        "MaintMarginReq": {"value": "3000.00", "currency": "USD"}
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### IBKR Integration Endpoints

#### `POST /api/ibkr/connect`

**Purpose**: Comprehensive IBKR connection establishment and validation

**Connection Sequence**:
1. **Health Check**: Test basic connectivity to IB Gateway/TWS
2. **Authentication Verification**: Confirm user login status
3. **Account Discovery**: Enumerate available trading accounts
4. **Paper Trading Detection**: Identify paper accounts (DU prefix)
5. **Configuration Validation**: Verify API settings

**Authentication States**:

| State | Description | Action Required |
|-------|-------------|-----------------|
| `authenticated: true` | Fully logged in | None - ready for trading |
| `authenticated: false` | Not logged in | Login to IB Gateway/TWS |
| `competing: true` | Multiple sessions | Close competing sessions |
| `connected: false` | Gateway unreachable | Start IB Gateway/TWS |

**Success Response Analysis**:
```json
{
    "success": true,
    "message": "Successfully connected to IBKR",
    "config": "Config(host='127.0.0.1', port=5000, protocol=http, rateLimit=1, verifySsl=false)",
    "health": {
        "serverName": "IB Gateway",
        "serverVersion": "10.19",
        "connectionTime": "20240101-12:00:00 EST",
        "isConnected": true
    },
    "authStatus": {
        "authenticated": true,
        "competing": false,
        "connected": true,
        "message": "Ready for trading"
    },
    "accounts": [
        {
            "accountId": "DU123456",
            "accountVan": "DU123456",
            "displayName": "Paper Trading Account",
            "accountType": "DEMO",
            "currency": "USD"
        }
    ]
}
```

## 🔒 Security Considerations

### API Security

1. **No Authentication**: Designed for internal use only
2. **CORS Enabled**: Allows cross-origin requests
3. **Input Validation**: JSON schema validation on requests
4. **Error Handling**: Sanitized error responses

### IBKR Security

1. **SSL Configuration**: Configurable SSL verification
2. **Rate Limiting**: Prevents API abuse
3. **Session Management**: Automatic session handling
4. **Account Isolation**: Proper account ID validation

## 📈 Performance Characteristics

### Rate Limiting

**IBKR API Limits**:
- Default: 1 request per second
- Maximum: 5 requests per second per endpoint
- Automatic rate limiting with busy-wait implementation

**Performance Metrics**:
- Strategy config operations: ~10ms response time
- IBKR account queries: ~500-2000ms (network dependent)
- File I/O operations: ~5ms for config updates

### Scalability

**Current Limits**:
- Single API server instance
- File-based configuration storage
- Synchronous IBKR operations

**Scaling Recommendations**:
- Database backend for configuration
- Redis for caching IBKR responses
- Load balancer for multiple API instances

## 🐛 Error Handling

### Error Categories

1. **Configuration Errors** (400)
   - Invalid JSON structure
   - Missing required fields
   - Invalid parameter ranges

2. **Authentication Errors** (401)
   - IBKR session expired
   - Invalid credentials
   - API permissions denied

3. **Not Found Errors** (404)
   - Strategy doesn't exist
   - Account not found
   - Invalid endpoint

4. **Server Errors** (500)
   - File system errors
   - Network connectivity issues
   - IBKR API failures

### Error Response Format

```json
{
    "error": "Error Category",
    "message": "Detailed error description",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "path": "/api/strategies/invalid-name",
    "details": {
        "code": "STRATEGY_NOT_FOUND",
        "suggestion": "Check available strategies with GET /api/strategies"
    }
}
```

## 🧪 Testing Strategies

### Unit Testing

```bash
# Test strategy configuration
curl -X GET http://localhost:3000/api/strategies

# Test strategy update
curl -X PUT http://localhost:3000/api/strategies/momentum \
  -H "Content-Type: application/json" \
  -d '{"config": {"allocation": 0.5}}'

# Test strategy enable/disable
curl -X POST http://localhost:3000/api/strategies/wyckoff-v2/enable
curl -X POST http://localhost:3000/api/strategies/momentum/disable
```

### Integration Testing

```bash
# Test IBKR connection (requires IB Gateway)
curl -X POST http://localhost:3000/api/ibkr/connect

# Test account data (requires authentication)
curl -X GET http://localhost:3000/api/account/holdings
curl -X GET http://localhost:3000/api/account/summary
```

### Load Testing

```bash
# Concurrent strategy queries
for i in {1..10}; do
  curl -X GET http://localhost:3000/api/strategies &
done
wait

# Strategy update stress test
for strategy in momentum mean-reversion wyckoff-v2; do
  curl -X PUT http://localhost:3000/api/strategies/$strategy \
    -H "Content-Type: application/json" \
    -d '{"config": {"allocation": 0.1}}' &
done
wait
```

## 📚 Usage Patterns

### Strategy Development Workflow

1. **Create Strategy**: Add to `available` array in config
2. **Test Configuration**: Use PUT endpoint to adjust parameters
3. **Enable Strategy**: Use POST `/enable` endpoint
4. **Monitor Performance**: Check account holdings and summary
5. **Adjust Parameters**: Use PUT endpoint for optimization
6. **Disable Strategy**: Use POST `/disable` endpoint if needed

### Portfolio Management Workflow

1. **Check Account Status**: Verify IBKR connection
2. **Review Holdings**: Get current positions
3. **Analyze Performance**: Compare with account summary
4. **Adjust Allocations**: Update strategy allocations
5. **Rebalance**: Enable/disable strategies as needed

### Monitoring and Alerting

```javascript
// Example monitoring script
setInterval(async () => {
    try {
        // Check API health
        const health = await fetch('/health').then(r => r.json());
        
        // Check IBKR status
        const ibkrStatus = await fetch('/api/ibkr/status').then(r => r.json());
        
        // Check account summary
        const summary = await fetch('/api/account/summary').then(r => r.json());
        
        // Alert on issues
        if (!health.status === 'healthy' || !ibkrStatus.connected) {
            alert('System health issue detected');
        }
        
        // Monitor account value
        const netLiq = parseFloat(summary.summary.NetLiquidation.value);
        if (netLiq < MIN_ACCOUNT_VALUE) {
            alert('Account value below threshold');
        }
        
    } catch (error) {
        console.error('Monitoring error:', error);
    }
}, 60000); // Check every minute
```

## 🔮 Future Enhancements

### Planned Features

1. **WebSocket Support**: Real-time updates for positions and P&L
2. **Database Integration**: PostgreSQL/MongoDB for configuration storage
3. **Authentication**: JWT-based API authentication
4. **Strategy Backtesting**: Historical performance analysis endpoints
5. **Risk Monitoring**: Real-time risk metrics and alerts
6. **Multi-Account Support**: Portfolio aggregation across accounts

### API Versioning

Future versions will maintain backward compatibility:
- `/api/v1/strategies` - Current implementation
- `/api/v2/strategies` - Enhanced with additional features
- Deprecation notices for older endpoints

This comprehensive API provides a solid foundation for algorithmic trading strategy management with robust IBKR integration and flexible configuration capabilities.
