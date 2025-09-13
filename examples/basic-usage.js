/**
 * Basic usage example for the IB Client Portal SDK
 * 
 * This example demonstrates how to:
 * 1. Connect to IB Gateway
 * 2. Check authentication status
 * 3. Query stock prices
 * 4. Handle errors gracefully
 */

import { createMarketDataClient, AuthenticationError, ConnectionError } from '../src/index.js';

async function main() {
    console.log('🚀 IB Client Portal SDK - Basic Usage Example\n');
    
    // Create a market data client with default configuration
    // This assumes IB Gateway is running on localhost:5000
    const client = createMarketDataClient({
        host: '127.0.0.1',
        port: 5000,
        rateLimit: 1.0, // 1 request per second
        verifySsl: false // IB Gateway uses self-signed certificates
    });
    
    try {
        // Step 1: Check if IB Gateway is running
        console.log('📡 Checking IB Gateway connection...');
        const healthStatus = await client.client.checkHealth();
        console.log('✅ IB Gateway is accessible');
        console.log('Health Status:', JSON.stringify(healthStatus, null, 2));
        console.log('');
        
        // Step 2: Check authentication status
        console.log('🔐 Checking authentication status...');
        const authStatus = await client.client.getAuthStatus();
        console.log('Authentication Status:', JSON.stringify(authStatus, null, 2));
        
        if (!authStatus.authenticated) {
            console.log('⚠️  Not authenticated. Please log in to IB Gateway first.');
            console.log('   1. Open IB Gateway or TWS');
            console.log('   2. Log in with your paper trading credentials');
            console.log('   3. Enable API connections');
            console.log('   4. Run this example again');
            return;
        }
        
        console.log('✅ Successfully authenticated!');
        console.log('');
        
        // Step 3: Get account information
        console.log('💼 Getting account information...');
        const accounts = await client.client.getAccounts();
        console.log('Available Accounts:', JSON.stringify(accounts, null, 2));
        console.log('');
        
        // Step 4: Query stock prices
        console.log('📈 Querying stock prices...');
        
        // Single stock price
        console.log('Getting AAPL price...');
        const aaplPrice = await client.getStockPrice('AAPL');
        console.log('AAPL Price Data:', JSON.stringify(aaplPrice, null, 2));
        
        if (aaplPrice.lastPrice) {
            console.log(`💰 AAPL Last Price: $${aaplPrice.lastPrice}`);
            console.log(`📊 Bid: $${aaplPrice.bid || 'N/A'} | Ask: $${aaplPrice.ask || 'N/A'}`);
            console.log(`📈 Volume: ${aaplPrice.volume || 'N/A'}`);
        }
        console.log('');
        
        // Multiple stock prices
        console.log('Getting multiple stock prices...');
        const symbols = ['MSFT', 'GOOGL', 'TSLA'];
        const multiPrices = await client.getMultipleStockPrices(symbols);
        
        console.log('📊 Multiple Stock Prices:');
        for (const [symbol, data] of Object.entries(multiPrices)) {
            if (data.error) {
                console.log(`❌ ${symbol}: Error - ${data.error}`);
            } else {
                const price = data.lastPrice || 'N/A';
                const change = data.change || 'N/A';
                const changePercent = data.changePercent || 'N/A';
                console.log(`💹 ${symbol}: $${price} (${change}, ${changePercent}%)`);
            }
        }
        console.log('');
        
        // Step 5: Check market status
        console.log('🕐 Checking market status...');
        const isOpen = await client.isMarketOpen();
        console.log(`📅 Market is currently: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
        console.log('');
        
        // Step 6: Get contract details
        console.log('📋 Getting contract details for AAPL...');
        const contractDetails = await client.getContractDetails('AAPL');
        console.log('Contract Details:', JSON.stringify(contractDetails, null, 2));
        
    } catch (error) {
        console.error('❌ Error occurred:');
        
        if (error instanceof ConnectionError) {
            console.error('🔌 Connection Error:', error.message);
            console.error('   Make sure IB Gateway is running on the correct port (5000)');
        } else if (error instanceof AuthenticationError) {
            console.error('🔐 Authentication Error:', error.message);
            console.error('   Please log in to IB Gateway first');
        } else {
            console.error('💥 Unexpected Error:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the example
main().catch(console.error);
