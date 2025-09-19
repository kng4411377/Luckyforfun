/**
 * Strategy testing and validation script
 */

import dotenv from 'dotenv';
import { createMarketDataClient } from '../src/index.js';
import { MomentumStrategy } from '../src/momentum-strategy.js';
import { logger } from '../src/logger.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

class StrategyTester {
    constructor() {
        this.config = this.loadConfig();
        this.marketDataClient = null;
        this.strategy = null;
    }
    
    loadConfig() {
        const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    async initialize() {
        logger.info('🧪 Initializing Strategy Tester...');
        
        this.marketDataClient = createMarketDataClient({
            host: process.env.IB_HOST || '127.0.0.1',
            port: parseInt(process.env.IB_PORT) || 5000,
            rateLimit: 1.0
        });
        
        this.strategy = new MomentumStrategy(this.config);
        
        // Test connection
        await this.marketDataClient.client.checkHealth();
        logger.info('✅ Connected to IB Gateway');
        
        const authStatus = await this.marketDataClient.client.getAuthStatus();
        if (!authStatus.authenticated) {
            throw new Error('Not authenticated with IB Gateway');
        }
        
        logger.info('✅ Strategy tester initialized');
    }
    
    /**
     * Test strategy on current market data
     */
    async testStrategy() {
        logger.info('🔍 Testing momentum strategy on current market data...');
        
        const testSymbols = this.config.watchlist.slice(0, 10); // Test first 10 symbols
        const results = [];
        
        // Collect historical data (simulated)
        for (const symbol of testSymbols) {
            try {
                logger.info(`Testing ${symbol}...`);
                
                // Get current market data
                const marketData = await this.marketDataClient.getStockPrice(symbol);
                
                if (marketData.error) {
                    logger.warn(`Skipping ${symbol}: ${marketData.error}`);
                    continue;
                }
                
                // Simulate historical data (in real implementation, you'd fetch actual historical data)
                await this.simulateHistoricalData(symbol, marketData.lastPrice);
                
                // Analyze with strategy
                const analysis = this.strategy.analyze(symbol, marketData);
                
                results.push({
                    symbol,
                    currentPrice: marketData.lastPrice,
                    volume: marketData.volume,
                    analysis
                });
                
                logger.info(`${symbol}: ${analysis.signal} (${analysis.strength}%) - ${analysis.reason}`);
                
                // Rate limiting
                await this.sleep(1000);
                
            } catch (error) {
                logger.error(`Error testing ${symbol}:`, error);
            }
        }
        
        this.displayResults(results);
        return results;
    }
    
    /**
     * Simulate historical price data for testing
     */
    async simulateHistoricalData(symbol, currentPrice) {
        const days = 30;
        const basePrice = currentPrice;
        
        for (let i = days; i >= 0; i--) {
            // Generate realistic price movement
            const randomFactor = 0.95 + (Math.random() * 0.1); // ±5% daily movement
            const trendFactor = 1 + ((Math.random() - 0.5) * 0.02); // Small trend
            const price = basePrice * randomFactor * trendFactor;
            const volume = Math.floor(1000000 + (Math.random() * 2000000)); // Random volume
            
            this.strategy.updatePriceHistory(symbol, price, volume);
        }
    }
    
    /**
     * Display test results
     */
    displayResults(results) {
        logger.info('\n📊 Strategy Test Results:');
        logger.info('=' .repeat(80));
        
        const buySignals = results.filter(r => r.analysis.signal === 'BUY');
        const sellSignals = results.filter(r => r.analysis.signal === 'SELL');
        const holdSignals = results.filter(r => r.analysis.signal === 'HOLD');
        
        logger.info(`Total symbols tested: ${results.length}`);
        logger.info(`BUY signals: ${buySignals.length}`);
        logger.info(`SELL signals: ${sellSignals.length}`);
        logger.info(`HOLD signals: ${holdSignals.length}`);
        
        if (buySignals.length > 0) {
            logger.info('\n🟢 BUY Signals:');
            buySignals.forEach(result => {
                logger.info(`  ${result.symbol}: $${result.currentPrice.toFixed(2)} - Strength: ${result.analysis.strength}%`);
                logger.info(`    Reason: ${result.analysis.reason}`);
            });
        }
        
        if (sellSignals.length > 0) {
            logger.info('\n🔴 SELL Signals:');
            sellSignals.forEach(result => {
                logger.info(`  ${result.symbol}: $${result.currentPrice.toFixed(2)} - Strength: ${result.analysis.strength}%`);
                logger.info(`    Reason: ${result.analysis.reason}`);
            });
        }
        
        // Show strongest signals
        const strongSignals = results
            .filter(r => r.analysis.signal !== 'HOLD' && r.analysis.strength >= 60)
            .sort((a, b) => b.analysis.strength - a.analysis.strength);
        
        if (strongSignals.length > 0) {
            logger.info('\n⭐ Strongest Signals:');
            strongSignals.slice(0, 5).forEach(result => {
                logger.info(`  ${result.symbol}: ${result.analysis.signal} (${result.analysis.strength}%)`);
            });
        }
        
        logger.info('=' .repeat(80));
    }
    
    /**
     * Test technical indicators
     */
    async testTechnicalIndicators() {
        logger.info('🔧 Testing technical indicators...');
        
        const testSymbol = 'AAPL';
        const marketData = await this.marketDataClient.getStockPrice(testSymbol);
        
        // Simulate price history
        await this.simulateHistoricalData(testSymbol, marketData.lastPrice);
        
        const history = this.strategy.priceHistory.get(testSymbol);
        const prices = history.map(h => h.price);
        
        // Test indicators
        const { TechnicalIndicators } = await import('../src/technical-indicators.js');
        
        const sma10 = TechnicalIndicators.sma(prices, 10);
        const sma20 = TechnicalIndicators.sma(prices, 20);
        const rsi = TechnicalIndicators.rsi(prices, 14);
        const momentum = TechnicalIndicators.momentum(prices, 10);
        const bollinger = TechnicalIndicators.bollingerBands(prices, 20, 2);
        
        logger.info(`\n📈 Technical Indicators for ${testSymbol}:`);
        logger.info(`Current Price: $${marketData.lastPrice.toFixed(2)}`);
        logger.info(`SMA(10): $${sma10?.toFixed(2) || 'N/A'}`);
        logger.info(`SMA(20): $${sma20?.toFixed(2) || 'N/A'}`);
        logger.info(`RSI(14): ${rsi?.toFixed(2) || 'N/A'}`);
        logger.info(`Momentum(10): ${momentum?.toFixed(2) || 'N/A'}%`);
        
        if (bollinger) {
            logger.info(`Bollinger Upper: $${bollinger.upper.toFixed(2)}`);
            logger.info(`Bollinger Middle: $${bollinger.middle.toFixed(2)}`);
            logger.info(`Bollinger Lower: $${bollinger.lower.toFixed(2)}`);
        }
    }
    
    /**
     * Test risk management calculations
     */
    testRiskManagement() {
        logger.info('🛡️ Testing risk management...');
        
        const testPrice = 150.00;
        const testAccountValue = 100000;
        
        // Test position sizing
        const positionSize = this.strategy.calculatePositionSize('TEST', testPrice, testAccountValue);
        logger.info(`Position size for $${testPrice} stock: ${positionSize} shares`);
        logger.info(`Position value: $${(positionSize * testPrice).toLocaleString()}`);
        
        // Test exit levels
        const buyExitLevels = this.strategy.calculateExitLevels('BUY', testPrice);
        const sellExitLevels = this.strategy.calculateExitLevels('SELL', testPrice);
        
        logger.info(`\nBUY position exit levels:`);
        logger.info(`  Entry: $${testPrice.toFixed(2)}`);
        logger.info(`  Stop Loss: $${buyExitLevels.stopLoss.toFixed(2)}`);
        logger.info(`  Take Profit: $${buyExitLevels.takeProfit.toFixed(2)}`);
        
        logger.info(`\nSELL position exit levels:`);
        logger.info(`  Entry: $${testPrice.toFixed(2)}`);
        logger.info(`  Stop Loss: $${sellExitLevels.stopLoss.toFixed(2)}`);
        logger.info(`  Take Profit: $${sellExitLevels.takeProfit.toFixed(2)}`);
    }
    
    /**
     * Run comprehensive strategy test
     */
    async runComprehensiveTest() {
        try {
            await this.initialize();
            
            logger.info('🚀 Running comprehensive strategy test...\n');
            
            // Test 1: Technical indicators
            await this.testTechnicalIndicators();
            
            // Test 2: Risk management
            this.testRiskManagement();
            
            // Test 3: Strategy analysis
            await this.testStrategy();
            
            logger.info('\n✅ Comprehensive strategy test completed');
            
        } catch (error) {
            logger.error('❌ Strategy test failed:', error);
            throw error;
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const tester = new StrategyTester();
    
    try {
        await tester.runComprehensiveTest();
    } catch (error) {
        logger.error('Test execution failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { StrategyTester };
