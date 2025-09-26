/**
 * Test Historical Data System
 * 
 * Demonstrates how to retrieve and analyze historical market data
 * from Interactive Brokers Client Portal API.
 */

import { createClient } from '../src/index.js';
import { HistoricalDataClient } from '../src/historical-data.js';

class HistoricalDataTest {
    constructor() {
        this.client = null;
        this.historicalClient = null;
    }

    async initialize() {
        console.log('📈 Initializing Historical Data Test...');
        
        // Create IB client
        this.client = createClient();
        
        // Test connection
        await this.client.checkHealth();
        console.log('✅ Connected to IB Client Portal');
        
        // Check authentication
        const authStatus = await this.client.getAuthStatus();
        if (!authStatus.authenticated) {
            throw new Error('❌ Not authenticated with IB Client Portal');
        }
        console.log('✅ Authenticated successfully');
        
        // Create historical data client
        this.historicalClient = new HistoricalDataClient(this.client);
        
        console.log('✅ Historical data system initialized');
    }

    async testBasicHistoricalData() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BASIC HISTORICAL DATA TEST');
        console.log('='.repeat(60));

        try {
            const symbol = 'AAPL';
            console.log(`Fetching 1-day historical data for ${symbol}...`);
            
            const data = await this.historicalClient.getHistoricalData(symbol, '1d', '5min');
            
            console.log('\n📈 Historical Data Summary:');
            console.log(`Symbol: ${data.symbol}`);
            console.log(`Description: ${data.metadata.description}`);
            console.log(`Period: ${data.metadata.period}`);
            console.log(`Bar Length: ${data.metadata.barLength} seconds`);
            console.log(`Total Bars: ${data.bars.length}`);
            
            if (data.summary) {
                console.log('\n💰 Price Summary:');
                console.log(`First Price: $${data.summary.firstPrice.toFixed(2)}`);
                console.log(`Last Price: $${data.summary.lastPrice.toFixed(2)}`);
                console.log(`Change: $${data.summary.change.toFixed(2)} (${data.summary.changePercent.toFixed(2)}%)`);
                console.log(`High: $${data.summary.high.toFixed(2)}`);
                console.log(`Low: $${data.summary.low.toFixed(2)}`);
                console.log(`Total Volume: ${data.summary.totalVolume.toLocaleString()}`);
                console.log(`Volatility: ${data.summary.volatility.toFixed(2)}%`);
            }

            console.log('\n📊 Recent Bars (Last 5):');
            const recentBars = data.bars.slice(-5);
            recentBars.forEach((bar, index) => {
                const time = new Date(bar.timestamp).toLocaleTimeString();
                console.log(`${index + 1}. ${time}: O=$${bar.open.toFixed(2)} H=$${bar.high.toFixed(2)} L=$${bar.low.toFixed(2)} C=$${bar.close.toFixed(2)} V=${bar.volume.toLocaleString()}`);
            });

            return data;

        } catch (error) {
            console.error('❌ Error in basic historical data test:', error.message);
            throw error;
        }
    }

    async testTechnicalIndicators() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TECHNICAL INDICATORS TEST');
        console.log('='.repeat(60));

        try {
            const symbol = 'AAPL';
            console.log(`Fetching historical data with technical indicators for ${symbol}...`);
            
            const data = await this.historicalClient.getHistoricalWithIndicators(symbol, '7d', '1h');
            
            console.log('\n📈 Technical Indicators:');
            
            if (data.indicators.sma_20.length > 0) {
                const sma20 = data.indicators.sma_20[data.indicators.sma_20.length - 1];
                console.log(`SMA(20): $${sma20.toFixed(2)}`);
            }
            
            if (data.indicators.sma_50.length > 0) {
                const sma50 = data.indicators.sma_50[data.indicators.sma_50.length - 1];
                console.log(`SMA(50): $${sma50.toFixed(2)}`);
            }
            
            if (data.indicators.rsi_14.length > 0) {
                const rsi = data.indicators.rsi_14[data.indicators.rsi_14.length - 1];
                console.log(`RSI(14): ${rsi.toFixed(2)}`);
            }
            
            if (data.indicators.bollinger.middle.length > 0) {
                const bb = data.indicators.bollinger;
                const lastIndex = bb.middle.length - 1;
                console.log(`Bollinger Bands:`);
                console.log(`  Upper: $${bb.upper[lastIndex].toFixed(2)}`);
                console.log(`  Middle: $${bb.middle[lastIndex].toFixed(2)}`);
                console.log(`  Lower: $${bb.lower[lastIndex].toFixed(2)}`);
            }
            
            if (data.indicators.macd.macd.length > 0) {
                const macd = data.indicators.macd;
                const lastIndex = macd.macd.length - 1;
                console.log(`MACD:`);
                console.log(`  MACD Line: ${macd.macd[lastIndex].toFixed(4)}`);
                if (macd.signal[lastIndex]) {
                    console.log(`  Signal Line: ${macd.signal[lastIndex].toFixed(4)}`);
                }
                if (macd.histogram[lastIndex]) {
                    console.log(`  Histogram: ${macd.histogram[lastIndex].toFixed(4)}`);
                }
            }

            console.log('\n🎯 Technical Summary:');
            if (data.technicalSummary) {
                console.log(`Trend: ${data.technicalSummary.trend}`);
                console.log(`Momentum: ${data.technicalSummary.momentum}`);
                console.log(`Volatility: ${data.technicalSummary.volatility}`);
                
                if (data.technicalSummary.signals.length > 0) {
                    console.log('Signals:');
                    data.technicalSummary.signals.forEach(signal => {
                        console.log(`  • ${signal}`);
                    });
                }
            }

            return data;

        } catch (error) {
            console.error('❌ Error in technical indicators test:', error.message);
            throw error;
        }
    }

    async testMultipleSymbols() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 MULTIPLE SYMBOLS TEST');
        console.log('='.repeat(60));

        try {
            const symbols = ['AAPL', 'MSFT', 'GOOGL'];
            console.log(`Fetching historical data for: ${symbols.join(', ')}`);
            
            const data = await this.historicalClient.getMultipleHistoricalData(symbols, '1d', '15min');
            
            console.log('\n📈 Multi-Symbol Summary:');
            
            for (const [symbol, symbolData] of Object.entries(data)) {
                console.log(`\n${symbol}:`);
                
                if (symbolData.error) {
                    console.log(`  ❌ Error: ${symbolData.error}`);
                    continue;
                }
                
                if (symbolData.summary) {
                    const s = symbolData.summary;
                    const changeColor = s.change >= 0 ? '🟢' : '🔴';
                    console.log(`  ${changeColor} Price: $${s.lastPrice.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%)`);
                    console.log(`  📊 Bars: ${symbolData.bars.length}`);
                    console.log(`  📈 High: $${s.high.toFixed(2)}`);
                    console.log(`  📉 Low: $${s.low.toFixed(2)}`);
                    console.log(`  📊 Volume: ${s.totalVolume.toLocaleString()}`);
                    console.log(`  ⚡ Volatility: ${s.volatility.toFixed(2)}%`);
                }
            }

            return data;

        } catch (error) {
            console.error('❌ Error in multiple symbols test:', error.message);
            throw error;
        }
    }

    async testDifferentTimeframes() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DIFFERENT TIMEFRAMES TEST');
        console.log('='.repeat(60));

        try {
            const symbol = 'AAPL';
            const timeframes = [
                { period: '1d', barSize: '5min', desc: '1 Day / 5 Min' },
                { period: '7d', barSize: '1h', desc: '1 Week / 1 Hour' },
                { period: '1m', barSize: '1d', desc: '1 Month / Daily' }
            ];

            console.log(`Testing different timeframes for ${symbol}:`);

            for (const tf of timeframes) {
                try {
                    console.log(`\n📊 ${tf.desc}:`);
                    const data = await this.historicalClient.getHistoricalData(symbol, tf.period, tf.barSize);
                    
                    console.log(`  Bars: ${data.bars.length}`);
                    if (data.summary) {
                        console.log(`  Change: ${data.summary.changePercent >= 0 ? '+' : ''}${data.summary.changePercent.toFixed(2)}%`);
                        console.log(`  Volatility: ${data.summary.volatility.toFixed(2)}%`);
                    }
                    
                    // Small delay between requests
                    await this.sleep(1000);
                    
                } catch (error) {
                    console.log(`  ❌ Error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('❌ Error in timeframes test:', error.message);
            throw error;
        }
    }

    async showAvailableOptions() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 AVAILABLE OPTIONS');
        console.log('='.repeat(60));

        const options = this.historicalClient.getAvailableOptions();
        
        console.log('📅 Available Periods:');
        options.periods.forEach(period => {
            console.log(`  • ${period} - ${options.description.periods[period]}`);
        });
        
        console.log('\n⏰ Available Bar Sizes:');
        options.barSizes.forEach(barSize => {
            console.log(`  • ${barSize} - ${options.description.barSizes[barSize]}`);
        });

        console.log('\n💡 Usage Examples:');
        console.log('  // Get 1 day of 5-minute bars');
        console.log('  await historicalClient.getHistoricalData("AAPL", "1d", "5min");');
        console.log('');
        console.log('  // Get 1 month of daily bars with technical indicators');
        console.log('  await historicalClient.getHistoricalWithIndicators("AAPL", "1m", "1d");');
        console.log('');
        console.log('  // Get multiple symbols');
        console.log('  await historicalClient.getMultipleHistoricalData(["AAPL", "MSFT"], "7d", "1h");');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const test = new HistoricalDataTest();

    try {
        await test.initialize();
        
        // Run all tests
        await test.testBasicHistoricalData();
        await test.testTechnicalIndicators();
        await test.testMultipleSymbols();
        await test.testDifferentTimeframes();
        await test.showAvailableOptions();

        console.log('\n🎉 All historical data tests completed successfully!');
        
        console.log('\n💡 Integration Tips:');
        console.log('1. Use historical data in your strategies for backtesting');
        console.log('2. Technical indicators help with signal generation');
        console.log('3. Cache is automatically managed (5-minute expiry)');
        console.log('4. Rate limiting is built-in for API compliance');

    } catch (error) {
        console.error('❌ Historical data test failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { HistoricalDataTest };
