/**
 * Automated Momentum Trading Bot
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { createMarketDataClient, createOrderClient } from '../src/index.js';
import { MomentumStrategy } from '../src/momentum-strategy.js';
import { logger, TradingLogger } from '../src/logger.js';

// Load environment variables
dotenv.config();

class MomentumTradingBot {
    constructor() {
        this.config = this.loadConfig();
        this.marketDataClient = null;
        this.orderClient = null;
        this.strategy = null;
        this.isRunning = false;
        this.dailyPnL = 0;
        this.startOfDayBalance = 0;
        this.lastScanTime = null;
        
        // Performance tracking
        this.stats = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            startTime: Date.now()
        };
    }
    
    /**
     * Load configuration from files
     */
    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Override with environment variables
            config.automation.enabled = process.env.TRADING_ENABLED === 'true';
            config.riskManagement.maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS) || config.riskManagement.maxDailyLoss;
            config.riskManagement.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE) || config.riskManagement.maxPositionSize;
            
            return config;
        } catch (error) {
            logger.error('Failed to load configuration:', error);
            throw error;
        }
    }
    
    /**
     * Initialize the trading bot
     */
    async initialize() {
        try {
            logger.info('🤖 Initializing Momentum Trading Bot...');
            
            // Create clients
            this.marketDataClient = createMarketDataClient({
                host: process.env.IB_HOST || '127.0.0.1',
                port: parseInt(process.env.IB_PORT) || 5000,
                rateLimit: 1.0
            });
            
            this.orderClient = createOrderClient({
                host: process.env.IB_HOST || '127.0.0.1',
                port: parseInt(process.env.IB_PORT) || 5000,
                rateLimit: 1.0
            });
            
            // Initialize strategy
            this.strategy = new MomentumStrategy(this.config);
            
            // Test connection
            await this.marketDataClient.client.checkHealth();
            logger.info('✅ Connected to IB Gateway');
            
            // Check authentication
            const authStatus = await this.marketDataClient.client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new Error('Not authenticated with IB Gateway');
            }
            
            // Get account information
            const accounts = await this.orderClient.client.getAccounts();
            const paperAccount = accounts.find(acc => acc.accountId.startsWith('DU'));
            
            if (!paperAccount) {
                throw new Error('No paper trading account found');
            }
            
            logger.info(`✅ Using paper trading account: ${paperAccount.accountId}`);
            
            // Get starting balance
            const accountSummary = await this.orderClient.client.getAccountSummary();
            this.startOfDayBalance = parseFloat(accountSummary.NetLiquidation?.value || 0);
            
            logger.info(`💰 Starting balance: $${this.startOfDayBalance.toLocaleString()}`);
            
            this.isRunning = true;
            logger.info('🚀 Momentum Trading Bot initialized successfully');
            
        } catch (error) {
            logger.error('❌ Failed to initialize trading bot:', error);
            throw error;
        }
    }
    
    /**
     * Main trading loop
     */
    async runTradingCycle() {
        if (!this.isRunning) return;
        
        try {
            logger.info('🔄 Starting trading cycle...');
            this.lastScanTime = new Date();
            
            // Check if we're within trading hours
            if (!this.isWithinTradingHours()) {
                logger.info('⏰ Outside trading hours, skipping cycle');
                return;
            }
            
            // Check daily loss limit
            if (this.dailyPnL <= -this.config.riskManagement.maxDailyLoss) {
                logger.warn(`🛑 Daily loss limit reached: $${this.dailyPnL.toFixed(2)}`);
                return;
            }
            
            // Get current positions
            const liveOrders = await this.orderClient.getLiveOrders();
            const currentPositions = this.strategy.getPositions();
            
            // Check exit signals for existing positions
            await this.checkExitSignals();
            
            // Scan for new opportunities if we have room for more positions
            if (currentPositions.size < this.config.riskManagement.maxPositions) {
                await this.scanForOpportunities();
            }
            
            // Update performance stats
            await this.updatePerformanceStats();
            
            logger.info(`✅ Trading cycle completed. Positions: ${currentPositions.size}/${this.config.riskManagement.maxPositions}`);
            
        } catch (error) {
            TradingLogger.logError(error, 'Trading cycle');
        }
    }
    
    /**
     * Check if current time is within trading hours
     */
    isWithinTradingHours() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour + (currentMinute / 60);
        
        const startTime = parseInt(this.config.automation.tradingHours.start.split(':')[0]) + 
                         (parseInt(this.config.automation.tradingHours.start.split(':')[1]) / 60);
        const endTime = parseInt(this.config.automation.tradingHours.end.split(':')[0]) + 
                       (parseInt(this.config.automation.tradingHours.end.split(':')[1]) / 60);
        
        // Check if it's weekend
        const dayOfWeek = now.getDay();
        if (!this.config.automation.weekendsEnabled && (dayOfWeek === 0 || dayOfWeek === 6)) {
            return false;
        }
        
        return currentTime >= startTime && currentTime <= endTime;
    }
    
    /**
     * Scan watchlist for trading opportunities
     */
    async scanForOpportunities() {
        logger.info('🔍 Scanning for trading opportunities...');
        
        const watchlist = this.config.watchlist;
        const batchSize = 5; // Process in batches to respect rate limits
        
        for (let i = 0; i < watchlist.length; i += batchSize) {
            const batch = watchlist.slice(i, i + batchSize);
            
            try {
                // Get market data for batch
                const marketData = await this.marketDataClient.getMultipleStockPrices(batch);
                
                // Analyze each symbol
                for (const symbol of batch) {
                    if (marketData[symbol] && !marketData[symbol].error) {
                        await this.analyzeSymbol(symbol, marketData[symbol]);
                    }
                }
                
                // Rate limiting delay
                await this.sleep(1000);
                
            } catch (error) {
                TradingLogger.logError(error, `Scanning batch: ${batch.join(', ')}`);
            }
        }
    }
    
    /**
     * Analyze a symbol for trading opportunities
     */
    async analyzeSymbol(symbol, marketData) {
        try {
            // Skip if we already have a position
            if (this.strategy.getPositions().has(symbol)) {
                return;
            }
            
            // Update price history
            this.strategy.updatePriceHistory(symbol, marketData.lastPrice, marketData.volume || 0);
            
            // Get analysis
            const analysis = this.strategy.analyze(symbol, marketData);
            
            // Check if signal is strong enough
            if (analysis.signal !== 'HOLD' && analysis.strength >= 60) {
                await this.executeEntry(symbol, analysis, marketData);
            }
            
        } catch (error) {
            TradingLogger.logError(error, `Analyzing ${symbol}`);
        }
    }
    
    /**
     * Execute entry order
     */
    async executeEntry(symbol, analysis, marketData) {
        try {
            const currentPrice = marketData.lastPrice;
            const accountSummary = await this.orderClient.client.getAccountSummary();
            const accountValue = parseFloat(accountSummary.NetLiquidation?.value || 0);
            
            // Calculate position size
            const positionSize = this.strategy.calculatePositionSize(symbol, currentPrice, accountValue);
            
            if (positionSize < 1) {
                logger.info(`⚠️ Position size too small for ${symbol}, skipping`);
                return;
            }
            
            // Calculate exit levels
            const exitLevels = this.strategy.calculateExitLevels(analysis.signal, currentPrice);
            
            TradingLogger.logSignal(`Entry signal for ${symbol}`, symbol, {
                signal: analysis.signal,
                strength: analysis.strength,
                price: currentPrice,
                size: positionSize,
                reason: analysis.reason
            });
            
            // Place bracket order
            const bracketOrder = await this.orderClient.placeBracketOrder(
                symbol,
                analysis.signal,
                positionSize,
                { orderType: 'MKT' }, // Market order for entry
                { price: exitLevels.takeProfit },
                { price: exitLevels.stopLoss },
                { timeInForce: 'DAY' }
            );
            
            // Track position
            this.strategy.addPosition(symbol, {
                side: analysis.signal,
                quantity: positionSize,
                entryPrice: currentPrice,
                stopLoss: exitLevels.stopLoss,
                takeProfit: exitLevels.takeProfit,
                orderId: bracketOrder.id,
                analysis: analysis
            });
            
            TradingLogger.logTrade('ENTRY', symbol, positionSize, currentPrice, bracketOrder.id);
            
        } catch (error) {
            TradingLogger.logError(error, `Executing entry for ${symbol}`);
        }
    }
    
    /**
     * Check exit signals for existing positions
     */
    async checkExitSignals() {
        const positions = this.strategy.getPositions();
        
        for (const [symbol, position] of positions) {
            try {
                // Get current market data
                const marketData = await this.marketDataClient.getStockPrice(symbol);
                
                // Check exit signal
                const exitSignal = this.strategy.checkExitSignal(symbol, position, marketData);
                
                if (exitSignal.signal !== 'HOLD' && exitSignal.urgency === 'HIGH') {
                    await this.executeExit(symbol, position, exitSignal, marketData);
                }
                
                // Rate limiting
                await this.sleep(1000);
                
            } catch (error) {
                TradingLogger.logError(error, `Checking exit for ${symbol}`);
            }
        }
    }
    
    /**
     * Execute exit order
     */
    async executeExit(symbol, position, exitSignal, marketData) {
        try {
            const currentPrice = marketData.lastPrice;
            const oppositeSide = position.side === 'BUY' ? 'SELL' : 'BUY';
            
            // Cancel existing bracket orders first
            try {
                const liveOrders = await this.orderClient.getLiveOrders();
                const relatedOrders = liveOrders.filter(order => 
                    order.ticker === symbol || order.parentId === position.orderId
                );
                
                for (const order of relatedOrders) {
                    await this.orderClient.cancelOrder(order.orderId);
                }
            } catch (error) {
                logger.warn(`Failed to cancel existing orders for ${symbol}:`, error.message);
            }
            
            // Place market order to exit
            const exitOrder = await this.orderClient.placeMarketOrder(
                symbol,
                oppositeSide,
                position.quantity
            );
            
            // Calculate P&L
            const pnl = position.side === 'BUY' 
                ? (currentPrice - position.entryPrice) * position.quantity
                : (position.entryPrice - currentPrice) * position.quantity;
            
            this.dailyPnL += pnl;
            this.stats.totalPnL += pnl;
            this.stats.totalTrades++;
            
            if (pnl > 0) {
                this.stats.winningTrades++;
            } else {
                this.stats.losingTrades++;
            }
            
            TradingLogger.logTrade('EXIT', symbol, position.quantity, currentPrice, exitOrder.id);
            TradingLogger.logRisk(exitSignal.reason, symbol, { pnl: pnl.toFixed(2) });
            
            // Remove position
            this.strategy.removePosition(symbol);
            
        } catch (error) {
            TradingLogger.logError(error, `Executing exit for ${symbol}`);
        }
    }
    
    /**
     * Update performance statistics
     */
    async updatePerformanceStats() {
        try {
            const accountSummary = await this.orderClient.client.getAccountSummary();
            const currentBalance = parseFloat(accountSummary.NetLiquidation?.value || 0);
            
            this.dailyPnL = currentBalance - this.startOfDayBalance;
            
            // Calculate drawdown
            const drawdown = Math.min(0, this.dailyPnL);
            this.stats.maxDrawdown = Math.min(this.stats.maxDrawdown, drawdown);
            
            // Log performance every hour
            const now = new Date();
            if (now.getMinutes() === 0) {
                TradingLogger.logPerformance({
                    dailyPnL: this.dailyPnL.toFixed(2),
                    totalTrades: this.stats.totalTrades,
                    winRate: this.stats.totalTrades > 0 ? 
                        ((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1) : 0,
                    positions: this.strategy.getPositions().size,
                    balance: currentBalance.toLocaleString()
                });
            }
            
        } catch (error) {
            TradingLogger.logError(error, 'Updating performance stats');
        }
    }
    
    /**
     * Start the automated trading bot
     */
    start() {
        if (!this.config.automation.enabled) {
            logger.warn('🚫 Trading automation is disabled in configuration');
            return;
        }
        
        logger.info('🚀 Starting automated momentum trading bot...');
        
        // Schedule trading cycles
        const cronExpression = `*/${this.config.automation.scanIntervalMinutes} * * * *`;
        
        cron.schedule(cronExpression, async () => {
            await this.runTradingCycle();
        });
        
        // Schedule daily reset
        cron.schedule('0 0 * * *', () => {
            this.resetDailyStats();
        });
        
        // Schedule performance logging
        cron.schedule('0 * * * *', async () => {
            await this.logHourlyPerformance();
        });
        
        logger.info(`⏰ Scheduled trading cycles every ${this.config.automation.scanIntervalMinutes} minutes`);
        logger.info('✅ Momentum trading bot is now running');
    }
    
    /**
     * Stop the trading bot
     */
    async stop() {
        logger.info('🛑 Stopping momentum trading bot...');
        this.isRunning = false;
        
        // Close all positions (optional)
        const positions = this.strategy.getPositions();
        for (const [symbol, position] of positions) {
            try {
                const marketData = await this.marketDataClient.getStockPrice(symbol);
                await this.executeExit(symbol, position, { signal: 'EXIT', reason: 'Bot shutdown' }, marketData);
            } catch (error) {
                logger.error(`Failed to close position for ${symbol}:`, error);
            }
        }
        
        logger.info('✅ Momentum trading bot stopped');
    }
    
    /**
     * Reset daily statistics
     */
    resetDailyStats() {
        this.dailyPnL = 0;
        this.startOfDayBalance = 0;
        logger.info('📊 Daily statistics reset');
    }
    
    /**
     * Log hourly performance
     */
    async logHourlyPerformance() {
        await this.updatePerformanceStats();
    }
    
    /**
     * Utility function to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const bot = new MomentumTradingBot();
    
    try {
        await bot.initialize();
        bot.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });
        
    } catch (error) {
        logger.error('Failed to start trading bot:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { MomentumTradingBot };
