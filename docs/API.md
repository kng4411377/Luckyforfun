# Trading Strategy Management API

This API provides endpoints for managing trading strategies, retrieving account information, and integrating with Interactive Brokers Client Portal.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment (optional):**
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

3. **Start the API server:**
   ```bash
   npm run api-server
   ```

4. **Test the connection:**
   ```bash
   curl http://localhost:3000/health
   ```

## Configuration

The API server can be configured using environment variables or constructor options:

### Environment Variables

```bash
# API Server
API_HOST=localhost
API_PORT=3000

# IBKR Client Portal
IB_HOST=127.0.0.1
IB_PORT=5000
IB_USE_HTTPS=false      # Set to true for HTTPS
IB_VERIFY_SSL=false     # SSL certificate verification
IB_RATE_LIMIT=1.0       # Requests per second
```

### Constructor Options

```javascript
import { createTradingAPIServer } from './src/api-server.js';

const server = createTradingAPIServer({
    // API Server settings
    host: 'localhost',
    port: 3000,
    
    // IBKR settings
    ibkrHost: '127.0.0.1',
    ibkrPort: 5000,
    ibkrUseHttps: false,    // HTTP by default
    ibkrVerifySsl: false,
    ibkrRateLimit: 1.0
});
```

## API Endpoints

### Health Check

#### GET /health
Check API server health and configuration.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "ibkrConfig": {
        "host": "127.0.0.1",
        "port": 5000,
        "protocol": "http"
    }
}
```

### Strategy Management

#### GET /api/strategies
Get all strategies (enabled and available).

**Response:**
```json
{
    "enabled": [
        {
            "name": "momentum",
            "config": {
                "enabled": true,
                "allocation": 0.3,
                "momentum": {
                    "lookbackDays": 20,
                    "thresholdPercentage": 5.0
                }
            }
        }
    ],
    "available": [...],
    "global": {
        "maxConcurrentStrategies": 3,
        "riskAllocation": {...}
    }
}
```

#### GET /api/strategies/:name
Get specific strategy configuration.

**Parameters:**
- `name` - Strategy name (e.g., "momentum", "mean-reversion")

**Response:**
```json
{
    "name": "momentum",
    "config": {
        "enabled": true,
        "allocation": 0.3,
        "momentum": {
            "lookbackDays": 20,
            "thresholdPercentage": 5.0
        }
    }
}
```

#### PUT /api/strategies/:name
Update strategy configuration.

**Parameters:**
- `name` - Strategy name

**Request Body:**
```json
{
    "config": {
        "enabled": true,
        "allocation": 0.4,
        "momentum": {
            "lookbackDays": 30,
            "thresholdPercentage": 6.0
        }
    }
}
```

**Response:**
```json
{
    "success": true,
    "message": "Strategy 'momentum' updated successfully",
    "strategy": {
        "name": "momentum",
        "config": {...}
    }
}
```

#### POST /api/strategies/:name/enable
Enable a strategy (move from available to enabled).

**Response:**
```json
{
    "success": true,
    "message": "Strategy 'wyckoff-v2' enabled successfully",
    "strategy": {...}
}
```

#### POST /api/strategies/:name/disable
Disable a strategy (move from enabled to available).

**Response:**
```json
{
    "success": true,
    "message": "Strategy 'momentum' disabled successfully",
    "strategy": {...}
}
```

### Account & Holdings

#### GET /api/account/status
Get account authentication status.

**Response:**
```json
{
    "authenticated": true,
    "accounts": [
        {
            "accountId": "DU123456",
            "accountVan": "DU123456",
            "displayName": "Paper Trading Account"
        }
    ],
    "primaryAccount": "DU123456"
}
```

#### GET /api/account/holdings
Get current portfolio positions.

**Query Parameters:**
- `accountId` (optional) - Specific account ID

**Response:**
```json
{
    "accountId": "DU123456",
    "positions": [
        {
            "contractId": 265598,
            "position": 100,
            "marketPrice": 150.25,
            "marketValue": 15025.00,
            "currency": "USD",
            "avgCost": 148.50,
            "unrealizedPnl": 175.00
        }
    ],
    "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET /api/account/summary
Get account summary information.

**Query Parameters:**
- `accountId` (optional) - Specific account ID

**Response:**
```json
{
    "accountId": "DU123456",
    "summary": {
        "NetLiquidation": {
            "value": "100000.00",
            "currency": "USD"
        },
        "TotalCashValue": {
            "value": "85000.00",
            "currency": "USD"
        },
        "GrossPositionValue": {
            "value": "15000.00",
            "currency": "USD"
        }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### IBKR Integration

#### POST /api/ibkr/connect
Connect to IBKR Client Portal and test authentication.

**Response:**
```json
{
    "success": true,
    "message": "Successfully connected to IBKR",
    "config": "Config(host='127.0.0.1', port=5000, protocol=http, rateLimit=1, verifySsl=false)",
    "health": {...},
    "authStatus": {
        "authenticated": true,
        "competing": false,
        "connected": true
    },
    "accounts": [...]
}
```

#### GET /api/ibkr/status
Get IBKR connection status.

**Response:**
```json
{
    "config": "Config(host='127.0.0.1', port=5000, protocol=http, rateLimit=1, verifySsl=false)",
    "health": {...},
    "authStatus": {...},
    "connected": true
}
```

## Error Responses

All endpoints may return the following error formats:

### 400 Bad Request
```json
{
    "error": "Invalid request",
    "message": "Strategy config is required"
}
```

### 401 Unauthorized
```json
{
    "error": "Authentication required",
    "message": "Not authenticated with IBKR"
}
```

### 404 Not Found
```json
{
    "error": "Strategy not found",
    "message": "Strategy 'invalid-name' does not exist"
}
```

### 500 Internal Server Error
```json
{
    "error": "Internal Server Error",
    "message": "Failed to load strategies config: ENOENT"
}
```

## Example Usage

### Update Strategy Configuration

```bash
curl -X PUT http://localhost:3000/api/strategies/momentum \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "enabled": true,
      "allocation": 0.4,
      "momentum": {
        "lookbackDays": 30,
        "thresholdPercentage": 6.0,
        "volumeThreshold": 1500000
      },
      "riskManagement": {
        "maxPositions": 3,
        "stopLossPercentage": 1.8
      }
    }
  }'
```

### Enable Strategy

```bash
curl -X POST http://localhost:3000/api/strategies/wyckoff-v2/enable
```

### Get Account Holdings

```bash
curl http://localhost:3000/api/account/holdings
```

### Connect to IBKR

```bash
curl -X POST http://localhost:3000/api/ibkr/connect
```

## Notes

1. **IBKR Gateway:** Ensure IB Gateway or TWS is running and authenticated before using account/holdings endpoints.

2. **HTTP vs HTTPS:** The API now supports both HTTP and HTTPS connections to IBKR Client Portal. Use `IB_USE_HTTPS=false` for HTTP (recommended for localhost).

3. **Rate Limiting:** The IBKR client enforces rate limiting (default 1 request/second) to comply with IB API limits.

4. **Strategy Configuration:** Changes to strategy configurations are immediately saved to `config/strategies.json`.

5. **Authentication:** The API server itself doesn't require authentication, but IBKR endpoints require an authenticated session with IB Gateway.
