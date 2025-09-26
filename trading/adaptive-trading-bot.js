/**
 * Adaptive Trading Bot
 * 
 * An intelligent trading bot that:
 * 1. Analyzes market conditions continuously
 * 2. Selects optimal strategies based on market regime
 * 3. Adapts strategy allocation based on performance
 * 4. Manages risk dynamically
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { createMarketDataClient, createOrderClient } from '../src/index.js';
import { StrategyManager } from "../src/strategy-manager.js";
import { AdaptiveStrategySelector } from '../src/adaptive-strategy-selector.js';
import { logger, TradingLogger } from '../src/logger.js';

// Load environment variables
dotenv.config();

class AdaptiveTradingBot {
    constructor() {
        this.config = this.loadConfig();
        this.marketDataClient = null;
        this.orderClient = null;
        this.strategyManager = null;
        this.adaptiveSelector = null;
        this.isRunning = false;
        this.dailyPnL = 0;
        this.startOfDayBalance = 0;
        this.lastScanTime = null;
        this.lastAdaptationTime = null;

        // Performance tracking
        this.stats = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            startTime: Date.now(),
            adaptations: 0,
            regimeChanges: 0
        };

        // Adaptation settings
        this.adaptationInterval = 30; // Minutes between adaptations
        this.minAdaptationInterval = 15; // Minimum minutes between adaptations
    }

    /**
     * Load configuration from files
     */
    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
            const strategiesPath = path.join(process.cwd(), 'config', 'strategies.json');
            
            let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (fs.existsSync(strategiesPath)) {
                const strategiesConfig = JSON.parse(fs.readFileSync(strategiesPath, 'utf8'));
                config = { ...config, ...strategiesConfig };
            }
            
            logger.info('✅ Configuration loaded successfully');
            return config;
        } catch (error) {
            logger.error('❌ Failed to load configuration:', error);
            throw error;
        }
    }

    /**
     * Initialize the adaptive trading bot
     */
    async initialize() {
        try {
            logger.info("🧠 Initializing Adaptive Trading Bot...");

            // Create clients
            this.marketDataClient = createMarketDataClient({
                host: process.env.IB_HOST || "127.0.0.1",
                port: parseInt(process.env.IB_PORT) || 5000,
                rateLimit: 1.0,
            });

            this.orderClient = createOrderClient({
                host: process.env.IB_HOST || "127.0.0.1",
                port: parseInt(process.env.IB_PORT) || 5000,
                rateLimit: 1.0,
            });

            // Initialize strategy manager
            this.strategyManager = new StrategyManager();
            await this.strategyManager.initialize(this.config);

            // Initialize adaptive selector
            this.adaptiveSelector = new AdaptiveStrategySelector(
                this.marketDataClient,
                this.strategyManager
            );

            // Test connection
            await this.marketDataClient.client.checkHealth();
            logger.info("✅ Connected to IB Gateway");

            // Check authentication
            const authStatus = await this.marketDataClient.client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new Error("Not authenticated with IB Gateway");
            }
            logger.info("✅ Authentication verified");

            // Get account information (with better error handling)
            let accounts;
            try {
                accounts = await this.orderClient.client.getAccounts();
            } catch (error) {
                // If getAccounts fails due to authentication, try to get auth status again
                logger.warn("⚠️ getAccounts failed, checking auth status...");
                const authCheck = await this.orderClient.client.getAuthStatus();
                if (authCheck.authenticated) {
                    logger.info("✅ Still authenticated, continuing without account validation");
                    accounts = [{ accountId: "DUE521517" }]; // Use default paper account
                } else {
                    throw new Error("Authentication lost");
                }
            }

            const paperAccount = accounts.find((acc) =>
                (acc.accountId || acc.id || "").startsWith("DU")
            );

            if (!paperAccount) {
                logger.warn("⚠️ No paper trading account found, using default");
                this.accountId = "DUE521517";
            } else {
                this.accountId = paperAccount.accountId || paperAccount.id;
            }

            logger.info(`✅ Using paper trading account: ${this.accountId}`);

            // Get starting balance (with error handling)
            try {
                const accountSummary = await this.orderClient.client.getAccountSummary(this.accountId);
                this.startOfDayBalance = parseFloat(
                    accountSummary.netliquidation?.amount || accountSummary.NetLiquidation?.value || 100000
                );
            } catch (error) {
                logger.warn("⚠️ Could not get account summary, using default balance");
                this.startOfDayBalance = 100000; // Default for paper trading
            }

            logger.info(
                `💰 Starting balance: $${this.startOfDayBalance.toLocaleString()}`
            );

            // Perform initial strategy selection
            await this.performInitialStrategySelection();

            this.isRunning = true;
            logger.info("🧠 Adaptive Trading Bot initialized successfully!");

        } catch (error) {
            logger.error("❌ Failed to initialize adaptive trading bot:", error);
            throw error;
        }
    }

    /**
     * Perform initial strategy selection based on current market conditions
     */
    async performInitialStrategySelection() {
        logger.info("🔍 Performing initial market analysis and strategy selection...");
        
        try {
            const selection = await this.adaptiveSelector.selectOptimalStrategies();
            
            logger.info(`📊 Initial market regime: ${selection.marketAnalysis.regime} (confidence: ${selection.marketAnalysis.confidence.toFixed(2)})`);
            logger.info(`🎯 Selected ${selection.recommendedStrategies.length} strategies:`);
            
            selection.recommendedStrategies.forEach(strategy => {
                logger.info(`   • ${strategy.name}: ${(strategy.allocation * 100).toFixed(1)}% allocation`);
            });

            this.lastAdaptationTime = Date.now();
            this.stats.adaptations++;

        } catch (error) {
            logger.error("❌ Error in initial strategy selection:", error);
            // Fallback to default strategies
            logger.info("🔄 Using fallback strategy configuration");
        }
    }

    /**
     * Start the adaptive trading bot
     */
    start() {
        if (!this.config.automation.enabled) {
            logger.warn("🚫 Trading automation is disabled in configuration");
            return;
        }

        logger.info("🚀 Starting adaptive trading bot...");

        // Schedule trading cycles
        const cronExpression = `*/${this.config.automation.scanIntervalMinutes} * * * *`;
        cron.schedule(cronExpression, async () => {
            await this.runTradingCycle();
        });

        // Schedule adaptive strategy selection
        const adaptationCron = `*/${this.adaptationInterval} * * * *`;
        cron.schedule(adaptationCron, async () => {
            await this.runAdaptationCycle();
        });

        // Schedule daily reset
        cron.schedule("0 0 * * *", () => {
            this.resetDailyStats();
        });

        // Schedule performance logging
        cron.schedule("0 * * * *", async () => {
            await this.logHourlyPerformance();
        });

        logger.info(`⏰ Trading cycles scheduled every ${this.config.automation.scanIntervalMinutes} minutes`);
        logger.info(`🧠 Adaptation cycles scheduled every ${this.adaptationInterval} minutes`);
        logger.info("✅ Adaptive trading bot is now running");
    }

    /**
     * Run a trading cycle (existing logic)
     */
    async runTradingCycle() {
        if (!this.isRunning) return;

        try {
            logger.info("🔄 Running trading cycle...");
            
            // Check trading hours
            if (!this.isWithinTradingHours()) {
                logger.info("⏰ Outside trading hours, skipping cycle");
                return;
            }

            // Get active strategies and run them
            const activeStrategies = this.strategyManager.getActiveStrategies();
            logger.info(`📊 Running ${activeStrategies.length} active strategies`);

            for (const strategyName of activeStrategies) {
                try {
                    await this.runStrategyAnalysis(strategyName);
                } catch (error) {
                    logger.error(`❌ Error running strategy ${strategyName}:`, error);
                }
            }

            this.lastScanTime = Date.now();

        } catch (error) {
            logger.error("❌ Error in trading cycle:", error);
        }
    }

    /**
     * Run an adaptation cycle (new adaptive logic)
     */
    async runAdaptationCycle() {
        if (!this.isRunning) return;

        try {
            // Check minimum time between adaptations
            if (this.lastAdaptationTime && 
                Date.now() - this.lastAdaptationTime < this.minAdaptationInterval * 60 * 1000) {
                return;
            }

            logger.info("🧠 Running adaptation cycle...");

            const selection = await this.adaptiveSelector.selectOptimalStrategies();
            
            if (selection.rebalanceExecuted) {
                logger.info("🔄 Strategy rebalancing executed");
                this.stats.adaptations++;
                
                if (selection.marketAnalysis.regime !== this.lastRegime) {
                    this.stats.regimeChanges++;
                    this.lastRegime = selection.marketAnalysis.regime;
                }
            }

            this.lastAdaptationTime = Date.now();

        } catch (error) {
            logger.error("❌ Error in adaptation cycle:", error);
        }
    }

    /**
     * Run strategy analysis for a specific strategy
     */
    async runStrategyAnalysis(strategyName) {
        try {
            const strategy = this.strategyManager.getStrategy(strategyName);
            if (!strategy) {
                logger.warn(`⚠️ Strategy ${strategyName} not found`);
                return;
            }

            // Analyze watchlist symbols
            const watchlist = this.config.watchlist || ['AAPL', 'MSFT', 'GOOGL'];
            
            for (const symbol of watchlist.slice(0, 5)) { // Limit to avoid rate limiting
                try {
                    // Get market data
                    const quote = await this.marketDataClient.getQuote(symbol);
                    
                    if (quote && quote.length > 0) {
                        // Run strategy analysis
                        const signal = await strategy.analyze(symbol, quote[0]);
                        
                        if (signal && signal.action !== 'HOLD') {
                            logger.info(`📊 ${strategyName} signal for ${symbol}: ${signal.action} (confidence: ${signal.confidence})`);
                            
                            // In a real implementation, you would execute trades here
                            // For now, we'll just log the signals
                            await this.handleTradingSignal(strategyName, symbol, signal);
                        }
                    }
                } catch (error) {
                    logger.warn(`⚠️ Error analyzing ${symbol} with ${strategyName}:`, error.message);
                }
                
                // Rate limiting
                await this.sleep(1000);
            }

        } catch (error) {
            logger.error(`❌ Error in strategy analysis for ${strategyName}:`, error);
        }
    }

    /**
     * Handle trading signal (placeholder for actual trade execution)
     */
    async handleTradingSignal(strategyName, symbol, signal) {
        try {
            // This is where you would implement actual trade execution
            // For now, we'll simulate and track performance
            
            logger.info(`🎯 Processing ${signal.action} signal for ${symbol} from ${strategyName}`);
            
            // Simulate trade result for performance tracking
            const simulatedResult = {
                symbol,
                action: signal.action,
                pnl: (Math.random() - 0.4) * 100, // Slightly positive bias for simulation
                timestamp: Date.now()
            };

            // Update strategy performance
            this.adaptiveSelector.updateStrategyPerformance(strategyName, simulatedResult);
            
            // Update bot statistics
            this.updateBotStatistics(simulatedResult);

        } catch (error) {
            logger.error(`❌ Error handling trading signal:`, error);
        }
    }

    /**
     * Update bot statistics
     */
    updateBotStatistics(tradeResult) {
        this.stats.totalTrades++;
        this.stats.totalPnL += tradeResult.pnl;
        this.dailyPnL += tradeResult.pnl;

        if (tradeResult.pnl > 0) {
            this.stats.winningTrades++;
        } else {
            this.stats.losingTrades++;
        }

        // Update max drawdown (simplified)
        if (this.stats.totalPnL < this.stats.maxDrawdown) {
            this.stats.maxDrawdown = this.stats.totalPnL;
        }
    }

    /**
     * Check if within trading hours
     */
    isWithinTradingHours() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour + minute / 60;

        const startTime = parseFloat(this.config.automation.tradingHours.start.replace(':', '.'));
        const endTime = parseFloat(this.config.automation.tradingHours.end.replace(':', '.'));

        return currentTime >= startTime && currentTime <= endTime;
    }

    /**
     * Reset daily statistics
     */
    resetDailyStats() {
        logger.info("🌅 Resetting daily statistics");
        this.dailyPnL = 0;
        
        // Update start of day balance
        this.startOfDayBalance += this.dailyPnL;
    }

    /**
     * Log hourly performance
     */
    async logHourlyPerformance() {
        try {
            const status = this.adaptiveSelector.getStatus();
            const winRate = this.stats.totalTrades > 0 ? 
                (this.stats.winningTrades / this.stats.totalTrades * 100).toFixed(1) : 0;

            logger.info("📊 Hourly Performance Report:");
            logger.info(`   💰 Total P&L: $${this.stats.totalPnL.toFixed(2)}`);
            logger.info(`   📈 Daily P&L: $${this.dailyPnL.toFixed(2)}`);
            logger.info(`   🎯 Win Rate: ${winRate}%`);
            logger.info(`   📊 Total Trades: ${this.stats.totalTrades}`);
            logger.info(`   🧠 Adaptations: ${this.stats.adaptations}`);
            logger.info(`   🌊 Regime Changes: ${this.stats.regimeChanges}`);
            logger.info(`   📊 Current Regime: ${status.currentRegime.regime} (${(status.currentRegime.confidence * 100).toFixed(1)}%)`);
            logger.info(`   🎯 Active Strategies: ${status.activeStrategies.map(s => s.name).join(', ')}`);

        } catch (error) {
            logger.error("❌ Error in hourly performance logging:", error);
        }
    }

    /**
     * Stop the trading bot
     */
    async stop() {
        logger.info("🛑 Stopping adaptive trading bot...");
        this.isRunning = false;
        
        // Save final performance report
        await this.logFinalPerformance();
        
        logger.info("✅ Adaptive trading bot stopped");
    }

    /**
     * Log final performance report
     */
    async logFinalPerformance() {
        const runTime = (Date.now() - this.stats.startTime) / (1000 * 60 * 60); // Hours
        const winRate = this.stats.totalTrades > 0 ? 
            (this.stats.winningTrades / this.stats.totalTrades * 100).toFixed(1) : 0;

        logger.info("📊 Final Performance Report:");
        logger.info(`   ⏰ Runtime: ${runTime.toFixed(1)} hours`);
        logger.info(`   💰 Total P&L: $${this.stats.totalPnL.toFixed(2)}`);
        logger.info(`   📈 Win Rate: ${winRate}%`);
        logger.info(`   📊 Total Trades: ${this.stats.totalTrades}`);
        logger.info(`   🧠 Total Adaptations: ${this.stats.adaptations}`);
        logger.info(`   🌊 Regime Changes: ${this.stats.regimeChanges}`);
        logger.info(`   📉 Max Drawdown: $${this.stats.maxDrawdown.toFixed(2)}`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            stats: this.stats,
            dailyPnL: this.dailyPnL,
            lastScanTime: this.lastScanTime,
            lastAdaptationTime: this.lastAdaptationTime,
            adaptiveSelector: this.adaptiveSelector ? this.adaptiveSelector.getStatus() : null
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const bot = new AdaptiveTradingBot();

    try {
        await bot.initialize();
        bot.start();

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            logger.info("Received SIGINT, shutting down gracefully...");
            await bot.stop();
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            logger.info("Received SIGTERM, shutting down gracefully...");
            await bot.stop();
            process.exit(0);
        });

        // Log status every 10 minutes
        setInterval(() => {
            const status = bot.getStatus();
            logger.info(`🤖 Bot Status: Running=${status.isRunning}, Trades=${status.stats.totalTrades}, P&L=$${status.stats.totalPnL.toFixed(2)}`);
        }, 10 * 60 * 1000);

    } catch (error) {
        logger.error("Failed to start adaptive trading bot:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { AdaptiveTradingBot };
