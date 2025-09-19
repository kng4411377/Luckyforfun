/**
 * API Server Example
 * 
 * This example demonstrates how to start the Trading API Server
 * which provides REST endpoints for:
 * 1. Strategy configuration management
 * 2. Account holdings retrieval
 * 3. IBKR integration
 */

import { createTradingAPIServer } from '../src/api-server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    console.log('🚀 Starting Trading API Server Example\n');
    
    // Create API server with configuration
    const server = createTradingAPIServer({
        // API Server settings
        host: process.env.API_HOST || 'localhost',
        port: process.env.API_PORT || 3000,
        
        // IBKR Client Portal settings
        ibkrHost: process.env.IB_HOST || '127.0.0.1',
        ibkrPort: parseInt(process.env.IB_PORT) || 5000,
        ibkrUseHttps: process.env.IB_USE_HTTPS === 'true' ? true : false, // Default to HTTP
        ibkrVerifySsl: process.env.IB_VERIFY_SSL === 'true',
        ibkrRateLimit: parseFloat(process.env.IB_RATE_LIMIT) || 1.0
    });
    
    try {
        // Start the server
        await server.start();
        
        console.log('\n📋 Available API Endpoints:');
        console.log('');
        console.log('Health Check:');
        console.log('  GET  /health');
        console.log('');
        console.log('Strategy Management:');
        console.log('  GET  /api/strategies              - Get all strategies');
        console.log('  GET  /api/strategies/:name        - Get specific strategy');
        console.log('  PUT  /api/strategies/:name        - Update strategy config');
        console.log('  POST /api/strategies/:name/enable - Enable strategy');
        console.log('  POST /api/strategies/:name/disable- Disable strategy');
        console.log('');
        console.log('Account & Holdings:');
        console.log('  GET  /api/account/status          - Get account status');
        console.log('  GET  /api/account/holdings        - Get current holdings');
        console.log('  GET  /api/account/summary         - Get account summary');
        console.log('');
        console.log('IBKR Integration:');
        console.log('  POST /api/ibkr/connect            - Connect to IBKR');
        console.log('  GET  /api/ibkr/status             - Get IBKR connection status');
        console.log('');
        
        console.log('📝 Example Usage:');
        console.log('');
        console.log('# Get all strategies');
        console.log('curl http://localhost:3000/api/strategies');
        console.log('');
        console.log('# Update momentum strategy config');
        console.log('curl -X PUT http://localhost:3000/api/strategies/momentum \\');
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'{"config": {"enabled": true, "allocation": 0.4}}\'');
        console.log('');
        console.log('# Get account holdings');
        console.log('curl http://localhost:3000/api/account/holdings');
        console.log('');
        console.log('# Connect to IBKR (ensure IB Gateway is running)');
        console.log('curl -X POST http://localhost:3000/api/ibkr/connect');
        console.log('');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down API server...');
            await server.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Shutting down API server...');
            await server.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start API server:', error.message);
        process.exit(1);
    }
}

// Run the example
main().catch(console.error);
