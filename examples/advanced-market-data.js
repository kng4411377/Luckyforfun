/**
 * Advanced market data example for the IB Client Portal SDK
 * 
 * This example demonstrates advanced market data features:
 * 1. Custom field selection
 * 2. Batch price queries
 * 3. Contract search and details
 * 4. Error handling for invalid symbols
 */

import { createMarketDataClient, InvalidSymbolError } from '../src/index.js';

async function advancedMarketDataExample() {
    console.log('📊 IB Client Portal SDK - Advanced Market Data Example\n');
    
    const client = createMarketDataClient({
        rateLimit: 1.0 // Respect rate limits
    });
    
    try {
        // Check connection first
        await client.client.checkHealth();
        const authStatus = await client.client.getAuthStatus();
        
        if (!authStatus.authenticated) {
            console.log('⚠️  Please authenticate with IB Gateway first');
            return;
        }
        
        console.log('✅ Connected and authenticated\n');
        
        // Example 1: Custom field selection
        console.log('📈 Example 1: Custom Market Data Fields');
        console.log('Getting bid, ask, last, volume, high, low for AAPL...');
        
        const customFields = ['31', '84', '86', '87', '70', '71']; // bid, ask, last, volume, high, low
        const customData = await client.getMarketDataSnapshot('AAPL', customFields);
        
        console.log('AAPL Custom Data:', JSON.stringify(customData.AAPL, null, 2));
        console.log('');
        
        // Example 2: Batch queries with popular stocks
        console.log('📊 Example 2: Batch Stock Price Queries');
        const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
        
        console.log(`Getting prices for ${popularStocks.length} stocks...`);
        const batchPrices = await client.getMultipleStockPrices(popularStocks);
        
        console.log('\\n📋 Stock Price Summary:');
        console.log('Symbol | Last Price | Change | Volume');
        console.log('-------|------------|--------|--------');
        
        for (const [symbol, data] of Object.entries(batchPrices)) {
            if (data.error) {
                console.log(`${symbol.padEnd(6)} | ERROR: ${data.error}`);
            } else {
                const price = data.lastPrice ? `$${data.lastPrice}` : 'N/A';
                const change = data.change ? `${data.change > 0 ? '+' : ''}${data.change}` : 'N/A';
                const volume = data.volume ? data.volume.toLocaleString() : 'N/A';
                console.log(`${symbol.padEnd(6)} | ${price.padEnd(10)} | ${change.padEnd(6)} | ${volume}`);
            }
        }
        console.log('');
        
        // Example 3: Symbol search and contract details
        console.log('🔍 Example 3: Symbol Search and Contract Details');
        
        const searchSymbol = 'AAPL';
        console.log(`Searching for contracts matching "${searchSymbol}"...`);
        
        const contracts = await client.searchSymbol(searchSymbol);
        console.log(`Found ${contracts.length} contracts:`);
        
        contracts.slice(0, 3).forEach((contract, index) => {
            console.log(`  ${index + 1}. ${contract.description || 'N/A'}`);
            console.log(`     Type: ${contract.secType}, Exchange: ${contract.exchange}`);
            console.log(`     Contract ID: ${contract.conid}`);
        });
        console.log('');
        
        // Get detailed contract information
        console.log(`Getting detailed contract info for ${searchSymbol}...`);
        const contractDetails = await client.getContractDetails(searchSymbol);
        
        console.log('Contract Details:');
        console.log(`  Company: ${contractDetails.companyName || 'N/A'}`);
        console.log(`  Industry: ${contractDetails.industry || 'N/A'}`);
        console.log(`  Currency: ${contractDetails.currency || 'N/A'}`);
        console.log(`  Exchange: ${contractDetails.exchange || 'N/A'}`);
        console.log('');
        
        // Example 4: Error handling with invalid symbols
        console.log('❌ Example 4: Error Handling with Invalid Symbols');
        
        const testSymbols = ['AAPL', 'INVALID123', 'MSFT', 'BADSTOCK'];
        console.log('Testing with mix of valid and invalid symbols...');
        
        for (const symbol of testSymbols) {
            try {
                const price = await client.getStockPrice(symbol);
                console.log(`✅ ${symbol}: $${price.lastPrice || 'N/A'}`);
            } catch (error) {
                if (error instanceof InvalidSymbolError) {
                    console.log(`❌ ${symbol}: Invalid symbol`);
                } else {
                    console.log(`⚠️  ${symbol}: ${error.message}`);
                }
            }
        }
        console.log('');
        
        // Example 5: Market status check
        console.log('🕐 Example 5: Market Status Check');
        const isOpen = await client.isMarketOpen();
        const status = isOpen ? '🟢 OPEN' : '🔴 CLOSED';
        console.log(`Market Status: ${status}`);
        
        if (!isOpen) {
            console.log('💡 Note: Prices may be delayed when market is closed');
        }
        
        console.log('\\n🎉 Advanced market data example completed!');
        
    } catch (error) {
        console.error('❌ Error in advanced market data example:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the example
advancedMarketDataExample().catch(console.error);
