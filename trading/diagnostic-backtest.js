/**
 * Diagnostic Backtesting Script
 * 
 * This version includes detailed logging to identify why symbols are skipped
 * and why data might be retrieved multiple times.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MomentumStrategy } from '../src/momentum-strategy.js';
import { logger } from '../src/logger.js';
import { createClient } from "../src/index.js";
import { HistoricalDataClient } from "../src/historical-data.js";

// Load environment variables
dotenv.config();

class DiagnosticBacktester {
    constructor() {
        this.config = this.loadConfig();
        this.strategy = new MomentumStrategy(this.config);
        this.initialCapital = this.config.backtesting.initialCapital || 100000;
        this.currentCapital = this.initialCapital;
        this.positions = new Map();
        this.trades = [];
        this.dailyReturns = [];
        this.client = null;
        this.historicalClient = null;
        
        // Diagnostic tracking
        this.diagnostics = {
            connectionAttempts: 0,
            authenticationAttempts: 0,
            dataRequests: 0,
            successfulDataFetches: 0,
            failedDataFetches: 0,
            skippedSymbols: [],
            errors: [],
            apiCallTimes: []
        };
    }

    /**
     * Initialize IB Client with detailed diagnostics
     */
    async initialize() {
        logger.info('🔍 DIAGNOSTIC MODE: Initializing connection to Interactive Brokers...');
        
        try {
            this.diagnostics.connectionAttempts++;
            
            // Create IB client
            this.client = createClient();
            logger.info('✅ IB Client created successfully');
            
            // Test connection with timeout
            logger.info('🔌 Testing connection to IB Gateway...');
            const connectionStart = Date.now();
            
            try {
                await Promise.race([
                    this.client.checkHealth(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
                    )
                ]);
                
                const connectionTime = Date.now() - connectionStart;
                logger.info(`✅ Connected to IB Client Portal (${connectionTime}ms)`);
                
            } catch (connError) {
                logger.error('❌ Connection failed:', connError.message);
                this.diagnostics.errors.push(`Connection: ${connError.message}`);
                throw connError;
            }
            
            // Check authentication with detailed info
            logger.info('🔐 Checking authentication status...');
            this.diagnostics.authenticationAttempts++;
            
            try {
                const authStatus = await this.client.getAuthStatus();
                logger.info('📋 Auth Status Response:', JSON.stringify(authStatus, null, 2));
                
                if (!authStatus.authenticated) {
                    const authError = new Error('❌ Not authenticated with IB Client Portal. Please login first.');
                    this.diagnostics.errors.push('Authentication failed - not logged in');
                    throw authError;
                }
                logger.info('✅ Authentication verified');
                
            } catch (authError) {
                logger.error('❌ Authentication check failed:', authError.message);
                this.diagnostics.errors.push(`Authentication: ${authError.message}`);
                throw authError;
            }
            
            // Create historical data client
            this.historicalClient = new HistoricalDataClient(this.client);
            logger.info('✅ Historical data client initialized');
            
            // Test a simple data request
            logger.info('🧪 Testing historical data capabilities...');
            try {
                const testData = await this.historicalClient.getHistoricalData('AAPL', '1d', '1h');
                logger.info(`✅ Test data fetch successful - got ${testData.bars?.length || 0} bars`);
            } catch (testError) {
                logger.warn('⚠️ Test data fetch failed:', testError.message);
                this.diagnostics.errors.push(`Test data fetch: ${testError.message}`);
            }
            
        } catch (error) {
            logger.error('❌ Failed to initialize diagnostic system:', error.message);
            this.diagnostics.errors.push(`Initialization: ${error.message}`);
            throw error;
        }
    }

    loadConfig() {
        const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    /**
     * Get real historical data with detailed diagnostics
     */
    async getRealHistoricalData(symbol, startDate, endDate) {
        const requestStart = Date.now();
        this.diagnostics.dataRequests++;
        
        try {
            logger.info(`🔍 DIAGNOSTIC: Fetching data for ${symbol}`);
            logger.info(`   📅 Date range: ${startDate} to ${endDate}`);
            
            // Calculate the period based on date range
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            
            logger.info(`   📊 Days difference: ${daysDiff}`);
            
            // Determine appropriate period and bar size
            let period, barSize;
            if (daysDiff <= 7) {
                period = '7d';
                barSize = '1h';
            } else if (daysDiff <= 30) {
                period = '1m';
                barSize = '1d';
            } else if (daysDiff <= 90) {
                period = '3m';
                barSize = '1d';
            } else if (daysDiff <= 365) {
                period = '1y';
                barSize = '1d';
            } else {
                period = '2y';
                barSize = '1d';
            }
            
            logger.info(`   ⚙️ Using period: ${period}, barSize: ${barSize}`);
            
            // Get historical data from IB
            const data = await this.historicalClient.getHistoricalData(symbol, period, barSize);
            
            const requestTime = Date.now() - requestStart;
            this.diagnostics.apiCallTimes.push(requestTime);
            
            logger.info(`   ⏱️ API call took: ${requestTime}ms`);
            
            if (!data) {
                logger.warn(`   ❌ No data object returned for ${symbol}`);
                this.diagnostics.failedDataFetches++;
                this.diagnostics.skippedSymbols.push({ symbol, reason: 'No data object returned' });
                throw new Error(`No data object returned for ${symbol}`);
            }
            
            if (!data.bars) {
                logger.warn(`   ❌ No bars array in data for ${symbol}`);
                logger.info(`   📋 Data structure:`, JSON.stringify(data, null, 2));
                this.diagnostics.failedDataFetches++;
                this.diagnostics.skippedSymbols.push({ symbol, reason: 'No bars array in response' });
                throw new Error(`No bars array in data for ${symbol}`);
            }
            
            if (data.bars.length === 0) {
                logger.warn(`   ❌ Empty bars array for ${symbol}`);
                this.diagnostics.failedDataFetches++;
                this.diagnostics.skippedSymbols.push({ symbol, reason: 'Empty bars array' });
                throw new Error(`Empty bars array for ${symbol}`);
            }
            
            logger.info(`   ✅ Raw data: ${data.bars.length} bars`);
            
            // Filter data to the exact date range if needed
            const filteredBars = data.bars.filter(bar => {
                const barDate = new Date(bar.timestamp);
                return barDate >= start && barDate <= end;
            });
            
            logger.info(`   🔍 After date filtering: ${filteredBars.length} bars`);
            
            // Convert to the format expected by the backtester
            const historicalData = filteredBars.map(bar => ({
                date: new Date(bar.timestamp),
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
            }));
            
            logger.info(`   ✅ Final processed data: ${historicalData.length} bars`);
            
            if (historicalData.length === 0) {
                this.diagnostics.failedDataFetches++;
                this.diagnostics.skippedSymbols.push({ symbol, reason: 'No bars after date filtering' });
                throw new Error(`No bars after date filtering for ${symbol}`);
            }
            
            // Log sample data
            if (historicalData.length > 0) {
                const firstBar = historicalData[0];
                const lastBar = historicalData[historicalData.length - 1];
                logger.info(`   📊 First bar: ${firstBar.date.toISOString()} - $${firstBar.close}`);
                logger.info(`   📊 Last bar: ${lastBar.date.toISOString()} - $${lastBar.close}`);
            }
            
            this.diagnostics.successfulDataFetches++;
            return historicalData;
            
        } catch (error) {
            const requestTime = Date.now() - requestStart;
            this.diagnostics.apiCallTimes.push(requestTime);
            
            logger.error(`   ❌ Error fetching data for ${symbol} (${requestTime}ms):`, error.message);
            this.diagnostics.failedDataFetches++;
            this.diagnostics.errors.push(`Data fetch ${symbol}: ${error.message}`);
            
            if (!this.diagnostics.skippedSymbols.find(s => s.symbol === symbol)) {
                this.diagnostics.skippedSymbols.push({ symbol, reason: error.message });
            }
            
            throw error;
        }
    }

    /**
     * Generate synthetic data as fallback
     */
    generateSyntheticData(symbol, days = 252) {
        logger.info(`🎲 Generating synthetic data for ${symbol} (${days} days)`);
        
        const data = [];
        let price = 100 + Math.random() * 100; // Starting price between $100-200
        
        for (let i = 0; i < days; i++) {
            // Generate realistic price movement
            const dailyReturn = (Math.random() - 0.5) * 0.04; // ±2% daily movement
            const trendFactor = Math.sin(i / 50) * 0.001; // Long-term trend
            const volatilityFactor = 0.5 + Math.random() * 0.5; // Variable volatility
            
            price = price * (1 + dailyReturn * volatilityFactor + trendFactor);
            
            // Ensure price doesn't go negative
            price = Math.max(price, 1);
            
            const volume = Math.floor(500000 + Math.random() * 2000000);
            
            data.push({
                date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
                open: price * (0.99 + Math.random() * 0.02),
                high: price * (1 + Math.random() * 0.02),
                low: price * (0.98 + Math.random() * 0.02),
                close: price,
                volume: volume
            });
        }
        
        logger.info(`✅ Generated ${data.length} synthetic bars for ${symbol}`);
        return data;
    }

    /**
     * Run diagnostic backtest
     */
    async runDiagnosticBacktest() {
        logger.info('🔍 Starting DIAGNOSTIC backtesting with detailed logging...');
        
        try {
            // Initialize with diagnostics
            await this.initialize();
            
            // Get date range from config
            const startDate = this.config.backtesting.startDate || '2024-01-01';
            const endDate = this.config.backtesting.endDate || '2024-10-01';
            
            logger.info(`📅 Diagnostic backtest period: ${startDate} to ${endDate}`);
            
            const testSymbols = this.config.watchlist.slice(0, 3); // Test only 3 symbols for diagnostics
            logger.info(`🎯 Testing symbols: ${testSymbols.join(', ')}`);
            
            const results = [];
            
            for (const symbol of testSymbols) {
                try {
                    logger.info(`\n${'='.repeat(50)}`);
                    logger.info(`🔍 PROCESSING SYMBOL: ${symbol}`);
                    logger.info(`${'='.repeat(50)}`);
                    
                    // Get real historical data from IB
                    let historicalData;
                    let dataSource = 'REAL';
                    
                    try {
                        historicalData = await this.getRealHistoricalData(symbol, startDate, endDate);
                    } catch (dataError) {
                        logger.warn(`⚠️ Real data failed for ${symbol}: ${dataError.message}`);
                        logger.info(`🎲 Falling back to synthetic data for ${symbol}`);
                        
                        historicalData = this.generateSyntheticData(symbol, 252);
                        dataSource = 'SYNTHETIC';
                    }
                    
                    if (!historicalData || historicalData.length === 0) {
                        logger.error(`❌ No data available for ${symbol} - SKIPPING`);
                        this.diagnostics.skippedSymbols.push({ symbol, reason: 'No data after all attempts' });
                        continue;
                    }
                    
                    logger.info(`✅ Using ${dataSource} data for ${symbol}: ${historicalData.length} bars`);
                    
                    // Run simple backtest (simplified for diagnostics)
                    const symbolResults = {
                        symbol,
                        dataSource,
                        barsProcessed: historicalData.length,
                        dateRange: {
                            start: historicalData[0]?.date,
                            end: historicalData[historicalData.length - 1]?.date
                        },
                        totalTrades: 0,
                        totalReturn: 0
                    };
                    
                    results.push(symbolResults);
                    
                    // Rate limiting - pause between symbols
                    logger.info('⏳ Waiting 2 seconds before next symbol...');
                    await this.sleep(2000);
                    
                } catch (error) {
                    logger.error(`❌ Error processing ${symbol}:`, error.message);
                    this.diagnostics.errors.push(`Processing ${symbol}: ${error.message}`);
                    this.diagnostics.skippedSymbols.push({ symbol, reason: `Processing error: ${error.message}` });
                }
            }
            
            // Display diagnostic results
            this.displayDiagnostics(results);
            
            return { results, diagnostics: this.diagnostics };
            
        } catch (error) {
            logger.error('❌ Diagnostic backtest failed:', error.message);
            this.diagnostics.errors.push(`Main execution: ${error.message}`);
            
            // Still display diagnostics even if failed
            this.displayDiagnostics([]);
            
            throw error;
        }
    }

    /**
     * Display comprehensive diagnostic information
     */
    displayDiagnostics(results) {
        logger.info('\n' + '='.repeat(60));
        logger.info('🔍 DIAGNOSTIC REPORT');
        logger.info('='.repeat(60));
        
        logger.info('\n📊 CONNECTION DIAGNOSTICS:');
        logger.info(`Connection attempts: ${this.diagnostics.connectionAttempts}`);
        logger.info(`Authentication attempts: ${this.diagnostics.authenticationAttempts}`);
        
        logger.info('\n📊 DATA FETCH DIAGNOSTICS:');
        logger.info(`Total data requests: ${this.diagnostics.dataRequests}`);
        logger.info(`Successful fetches: ${this.diagnostics.successfulDataFetches}`);
        logger.info(`Failed fetches: ${this.diagnostics.failedDataFetches}`);
        
        if (this.diagnostics.apiCallTimes.length > 0) {
            const avgTime = this.diagnostics.apiCallTimes.reduce((a, b) => a + b, 0) / this.diagnostics.apiCallTimes.length;
            const maxTime = Math.max(...this.diagnostics.apiCallTimes);
            const minTime = Math.min(...this.diagnostics.apiCallTimes);
            
            logger.info(`API call times - Avg: ${avgTime.toFixed(0)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
        }
        
        logger.info('\n❌ SKIPPED SYMBOLS:');
        if (this.diagnostics.skippedSymbols.length === 0) {
            logger.info('None - all symbols processed successfully!');
        } else {
            this.diagnostics.skippedSymbols.forEach(skip => {
                logger.info(`${skip.symbol}: ${skip.reason}`);
            });
        }
        
        logger.info('\n🔴 ERRORS ENCOUNTERED:');
        if (this.diagnostics.errors.length === 0) {
            logger.info('None - clean execution!');
        } else {
            this.diagnostics.errors.forEach((error, index) => {
                logger.info(`${index + 1}. ${error}`);
            });
        }
        
        logger.info('\n✅ SUCCESSFUL RESULTS:');
        results.forEach(result => {
            logger.info(`${result.symbol}: ${result.barsProcessed} bars (${result.dataSource})`);
        });
        
        logger.info('\n💡 RECOMMENDATIONS:');
        if (this.diagnostics.connectionAttempts > 1) {
            logger.info('• Connection issues detected - check IB Gateway status');
        }
        if (this.diagnostics.authenticationAttempts > 1) {
            logger.info('• Authentication issues - ensure you are logged into IB Gateway/TWS');
        }
        if (this.diagnostics.failedDataFetches > this.diagnostics.successfulDataFetches) {
            logger.info('• More data fetches failed than succeeded - check API permissions and data subscriptions');
        }
        if (this.diagnostics.apiCallTimes.some(t => t > 5000)) {
            logger.info('• Some API calls took >5s - potential network or server issues');
        }
        
        logger.info('='.repeat(60));
    }

    /**
     * Utility method for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const backtester = new DiagnosticBacktester();
    
    try {
        logger.info('🔍 Starting DIAGNOSTIC Real Data Backtesting System...');
        logger.info('📋 This will help identify why symbols are skipped or data retrieved multiple times');
        
        const results = await backtester.runDiagnosticBacktest();
        
        // Export diagnostic results
        const filename = `diagnostic-backtest-${Date.now()}.json`;
        const filepath = path.join('logs', filename);
        
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs', { recursive: true });
        }
        
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
        logger.info(`📁 Diagnostic results exported to: ${filepath}`);
        
        logger.info('✅ Diagnostic backtest completed!');
        
    } catch (error) {
        logger.error('❌ Diagnostic backtest failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { DiagnosticBacktester };
