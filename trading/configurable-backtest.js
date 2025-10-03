/**
 * Configurable Backtesting Framework
 * 
 * This version allows you to configure time intervals and bar sizes
 * through configuration files or parameters.
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

class ConfigurableBacktester {
    constructor(customTimeframe = null) {
        this.config = this.loadConfig();
        this.strategy = new MomentumStrategy(this.config);
        this.initialCapital = this.config.backtesting.initialCapital || 100000;
        this.currentCapital = this.initialCapital;
        this.positions = new Map();
        this.trades = [];
        this.dailyReturns = [];
        this.client = null;
        this.historicalClient = null;
        
        // Custom timeframe override
        this.customTimeframe = customTimeframe;
    }

    /**
     * Initialize IB Client and Historical Data Client
     */
    async initialize() {
        logger.info("🔌 Initializing connection to Interactive Brokers...");

        try {
            // Create IB client
            this.client = createClient();

            // Test connection
            await this.client.checkHealth();
            logger.info("✅ Connected to IB Client Portal");

            // Check authentication
            const authStatus = await this.client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new Error(
                    "❌ Not authenticated with IB Client Portal. Please login first."
                );
            }
            logger.info("✅ Authenticated successfully");

            // Create historical data client
            this.historicalClient = new HistoricalDataClient(this.client);

            logger.info("✅ Historical data system initialized");
        } catch (error) {
            logger.error("❌ Failed to initialize IB connection:", error.message);
            throw error;
        }
    }

    loadConfig() {
        const configPath = path.join(process.cwd(), "config", "trading-config.json");
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    /**
     * Determine time intervals based on configuration or date range
     */
    determineTimeIntervals(startDate, endDate) {
        // Check if custom timeframe is provided
        if (this.customTimeframe) {
            logger.info(`⚙️ Using custom timeframe: ${this.customTimeframe.period}/${this.customTimeframe.barSize}`);
            return this.customTimeframe;
        }

        // Check if timeframe is specified in config
        if (this.config.backtesting.timeframe && this.config.backtesting.timeframe.customPeriod) {
            const configTimeframe = {
                period: this.config.backtesting.timeframe.period,
                barSize: this.config.backtesting.timeframe.barSize
            };
            logger.info(`⚙️ Using config timeframe: ${configTimeframe.period}/${configTimeframe.barSize}`);
            return configTimeframe;
        }

        // Auto-determine based on date range (existing logic)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        let period, barSize;
        if (daysDiff <= 1) {
            period = "1d";
            barSize = "5min";
        } else if (daysDiff <= 7) {
            period = "7d";
            barSize = "1h";
        } else if (daysDiff <= 30) {
            period = "1m";
            barSize = "1d";
        } else if (daysDiff <= 90) {
            period = "3m";
            barSize = "1d";
        } else if (daysDiff <= 365) {
            period = "1y";
            barSize = "1d";
        } else {
            period = "2y";
            barSize = "1d";
        }

        logger.info(`⚙️ Auto-determined timeframe for ${daysDiff} days: ${period}/${barSize}`);
        return { period, barSize };
    }

    /**
     * Get real historical data with configurable time intervals
     */
    async getRealHistoricalData(symbol, startDate, endDate) {
        try {
            logger.info(`📊 Fetching historical data for ${symbol} from ${startDate} to ${endDate}`);

            // Determine time intervals
            const timeframe = this.determineTimeIntervals(startDate, endDate);
            const { period, barSize } = timeframe;

            logger.info(`📈 Using timeframe: ${period} period, ${barSize} bars`);

            // Get historical data from IB
            const data = await this.historicalClient.getHistoricalData(symbol, period, barSize);

            if (!data || !data.bars || data.bars.length === 0) {
                throw new Error(`No historical data available for ${symbol}`);
            }

            logger.info(`📊 Retrieved ${data.bars.length} raw bars from IB for ${symbol}`);

            // Check the actual date range of available data
            if (data.bars.length > 0) {
                const firstBar = new Date(data.bars[0].timestamp);
                const lastBar = new Date(data.bars[data.bars.length - 1].timestamp);
                logger.info(`📅 Available data range: ${firstBar.toDateString()} to ${lastBar.toDateString()}`);
                logger.info(`⏰ Bar interval: ${barSize}`);
            }

            // Filter and process data
            const start = new Date(startDate);
            const end = new Date(endDate);

            const filteredBars = data.bars.filter((bar) => {
                const barDate = new Date(bar.timestamp);
                return barDate >= start && barDate <= end;
            });

            let finalBars;
            if (filteredBars.length === 0) {
                logger.warn(`⚠️ No bars in exact date range for ${symbol}`);
                const recentBars = data.bars.slice(-252);
                logger.info(`✅ Using ${recentBars.length} most recent available bars instead`);
                finalBars = recentBars;
            } else {
                logger.info(`✅ Found ${filteredBars.length} bars in requested date range`);
                finalBars = filteredBars;
            }

            // Convert to the format expected by the backtester
            const historicalData = finalBars.map((bar) => ({
                date: new Date(bar.timestamp),
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
            }));

            // Sort by date to ensure chronological order
            historicalData.sort((a, b) => a.date - b.date);

            logger.info(`✅ Final processed data: ${historicalData.length} ${barSize} bars for ${symbol}`);

            return { data: historicalData, timeframe };

        } catch (error) {
            logger.error(`❌ Error fetching historical data for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Generate synthetic data with configurable intervals
     */
    generateSyntheticData(symbol, days = 252, barSize = "1d") {
        logger.info(`🎲 Generating synthetic ${barSize} data for ${symbol} (${days} periods)`);

        const data = [];
        let price = 100 + Math.random() * 100;

        // Determine time increment based on bar size
        let timeIncrement;
        switch (barSize) {
            case '1min': timeIncrement = 1 * 60 * 1000; break;
            case '5min': timeIncrement = 5 * 60 * 1000; break;
            case '15min': timeIncrement = 15 * 60 * 1000; break;
            case '30min': timeIncrement = 30 * 60 * 1000; break;
            case '1h': timeIncrement = 60 * 60 * 1000; break;
            case '1d': timeIncrement = 24 * 60 * 60 * 1000; break;
            default: timeIncrement = 24 * 60 * 60 * 1000; // Default to daily
        }

        const startTime = Date.now() - (days * timeIncrement);

        for (let i = 0; i < days; i++) {
            const dailyReturn = (Math.random() - 0.5) * 0.04;
            const trendFactor = Math.sin(i / 50) * 0.001;
            const volatilityFactor = 0.5 + Math.random() * 0.5;

            price = price * (1 + dailyReturn * volatilityFactor + trendFactor);
            price = Math.max(price, 1);

            const volume = Math.floor(500000 + Math.random() * 2000000);
            const currentTime = startTime + (i * timeIncrement);

            data.push({
                date: new Date(currentTime),
                open: price * (0.99 + Math.random() * 0.02),
                high: price * (1 + Math.random() * 0.02),
                low: price * (0.98 + Math.random() * 0.02),
                close: price,
                volume: volume,
            });
        }

        return { data, timeframe: { period: 'synthetic', barSize } };
    }

    /**
     * Run backtest on a single symbol
     */
    backtestSymbol(symbol, historicalData, timeframe) {
        logger.info(`📊 Backtesting ${symbol} with ${timeframe.barSize} intervals...`);

        const results = {
            symbol,
            timeframe,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalReturn: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            trades: [],
        };

        // Adjust strategy parameters based on timeframe
        this.adjustStrategyForTimeframe(timeframe.barSize);

        // Build price history for strategy
        for (let i = 0; i < Math.min(30, historicalData.length); i++) {
            const candle = historicalData[i];
            this.strategy.updatePriceHistory(symbol, candle.close, candle.volume);
        }

        // Run through historical data
        for (let i = 30; i < historicalData.length; i++) {
            const candle = historicalData[i];
            const marketData = {
                lastPrice: candle.close,
                volume: candle.volume,
                high: candle.high,
                low: candle.low,
            };

            // Update price history
            this.strategy.updatePriceHistory(symbol, candle.close, candle.volume);

            // Check for entry signals
            if (!this.positions.has(symbol)) {
                const analysis = this.strategy.analyze(symbol, marketData);

                if (analysis.signal !== "HOLD" && analysis.strength >= 40) {
                    this.enterPosition(symbol, analysis, candle, results);
                }
            } else {
                // Check for exit signals
                const position = this.positions.get(symbol);
                const exitSignal = this.strategy.checkExitSignal(
                    symbol,
                    position,
                    marketData
                );

                if (exitSignal.signal !== "HOLD") {
                    this.exitPosition(symbol, candle, exitSignal.reason, results);
                }
            }
        }

        // Close any remaining positions
        if (this.positions.has(symbol)) {
            const lastCandle = historicalData[historicalData.length - 1];
            this.exitPosition(symbol, lastCandle, "End of backtest", results);
        }

        return results;
    }

    /**
     * Adjust strategy parameters based on timeframe
     */
    adjustStrategyForTimeframe(barSize) {
        logger.info(`⚙️ Adjusting strategy parameters for ${barSize} timeframe`);

        // Adjust lookback periods based on bar size
        switch (barSize) {
            case '1min':
            case '5min':
                // High frequency - use shorter lookbacks
                this.strategy.config.momentum.lookbackDays = 60; // 60 bars
                this.strategy.config.technicalIndicators.rsi.period = 14;
                break;
            case '15min':
            case '30min':
                // Medium frequency
                this.strategy.config.momentum.lookbackDays = 40; // 40 bars
                this.strategy.config.technicalIndicators.rsi.period = 14;
                break;
            case '1h':
                // Hourly - moderate lookbacks
                this.strategy.config.momentum.lookbackDays = 30; // 30 bars
                this.strategy.config.technicalIndicators.rsi.period = 14;
                break;
            case '1d':
            default:
                // Daily - standard lookbacks
                this.strategy.config.momentum.lookbackDays = 20; // 20 bars
                this.strategy.config.technicalIndicators.rsi.period = 14;
                break;
        }

        logger.info(`📊 Adjusted lookback to ${this.strategy.config.momentum.lookbackDays} ${barSize} bars`);
    }

    /**
     * Enter a position
     */
    enterPosition(symbol, analysis, candle, results) {
        const entryPrice = candle.close;
        const positionSize = this.strategy.calculatePositionSize(
            symbol,
            entryPrice,
            this.currentCapital
        );

        if (positionSize < 1) return;

        const exitLevels = this.strategy.calculateExitLevels(
            analysis.signal,
            entryPrice
        );
        const positionValue = positionSize * entryPrice;

        if (positionValue > this.currentCapital * 0.2) {
            return;
        }

        const position = {
            side: analysis.signal,
            quantity: positionSize,
            entryPrice: entryPrice,
            entryDate: candle.date,
            stopLoss: exitLevels.stopLoss,
            takeProfit: exitLevels.takeProfit,
            analysis: analysis,
        };

        this.positions.set(symbol, position);
        this.currentCapital -= positionValue;

        logger.debug(
            `📈 Entered ${analysis.signal} position: ${symbol} @ $${entryPrice.toFixed(2)}`
        );
    }

    /**
     * Exit a position
     */
    exitPosition(symbol, candle, reason, results) {
        const position = this.positions.get(symbol);
        if (!position) return;

        const exitPrice = candle.close;
        const positionValue = position.quantity * position.entryPrice;

        let pnl;
        if (position.side === "BUY") {
            pnl = (exitPrice - position.entryPrice) * position.quantity;
        } else {
            pnl = (position.entryPrice - exitPrice) * position.quantity;
        }

        this.currentCapital += positionValue + pnl;

        const trade = {
            symbol,
            side: position.side,
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice: exitPrice,
            entryDate: position.entryDate,
            exitDate: candle.date,
            pnl: pnl,
            pnlPercent: (pnl / positionValue) * 100,
            reason: reason,
            holdingDays: Math.floor(
                (candle.date - position.entryDate) / (1000 * 60 * 60 * 24)
            ),
        };

        this.trades.push(trade);
        results.trades.push(trade);
        results.totalTrades++;

        if (pnl > 0) {
            results.winningTrades++;
        } else {
            results.losingTrades++;
        }

        results.totalReturn += pnl;
        this.positions.delete(symbol);

        logger.debug(
            `📉 Exited position: ${symbol} @ $${exitPrice.toFixed(2)} - P&L: $${pnl.toFixed(2)} (${reason})`
        );
    }

    /**
     * Run configurable backtest
     */
    async runConfigurableBacktest() {
        logger.info("⚙️ Starting CONFIGURABLE backtesting with custom time intervals...");

        try {
            await this.initialize();

            const startDate = this.config.backtesting.startDate || "2023-01-01";
            const endDate = this.config.backtesting.endDate || "2023-12-31";

            logger.info(`📅 Backtest period: ${startDate} to ${endDate}`);

            const testSymbols = this.config.watchlist.slice(0, 5);
            const results = [];

            for (const symbol of testSymbols) {
                try {
                    logger.info(`\n🔍 Processing ${symbol}...`);

                    let historicalResult;
                    let dataSource = "REAL";

                    try {
                        historicalResult = await this.getRealHistoricalData(symbol, startDate, endDate);
                    } catch (dataError) {
                        logger.warn(`⚠️ Failed to get real data for ${symbol}, using synthetic data: ${dataError.message}`);
                        const timeframe = this.determineTimeIntervals(startDate, endDate);
                        historicalResult = this.generateSyntheticData(symbol, 252, timeframe.barSize);
                        dataSource = "SYNTHETIC";
                    }

                    if (!historicalResult.data || historicalResult.data.length === 0) {
                        logger.warn(`⚠️ No data available for ${symbol}, skipping...`);
                        continue;
                    }

                    logger.info(`✅ Using ${dataSource} data: ${historicalResult.data.length} ${historicalResult.timeframe.barSize} bars`);

                    const symbolResults = this.backtestSymbol(symbol, historicalResult.data, historicalResult.timeframe);
                    symbolResults.dataSource = dataSource;
                    symbolResults.barsProcessed = historicalResult.data.length;
                    
                    results.push(symbolResults);

                    await this.sleep(1000);

                } catch (error) {
                    logger.error(`❌ Error backtesting ${symbol}:`, error.message);
                }
            }

            if (results.length === 0) {
                throw new Error("No successful backtests completed");
            }

            const overallResults = this.calculateOverallPerformance(results);
            this.displayResults(overallResults, results);

            return { overall: overallResults, bySymbol: results };

        } catch (error) {
            logger.error("❌ Configurable backtest failed:", error.message);
            throw error;
        }
    }

    /**
     * Calculate overall performance metrics
     */
    calculateOverallPerformance(symbolResults) {
        const allTrades = symbolResults.flatMap((r) => r.trades);

        if (allTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                averageReturn: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                profitFactor: 0,
            };
        }

        const totalTrades = allTrades.length;
        const winningTrades = allTrades.filter((t) => t.pnl > 0);
        const losingTrades = allTrades.filter((t) => t.pnl <= 0);

        const totalReturn = allTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalReturnPercent = (totalReturn / this.initialCapital) * 100;
        const averageReturn = totalReturn / totalTrades;

        const winRate = (winningTrades.length / totalTrades) * 100;

        const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

        let peak = this.initialCapital;
        let maxDrawdown = 0;
        let runningCapital = this.initialCapital;

        for (const trade of allTrades) {
            runningCapital += trade.pnl;
            if (runningCapital > peak) {
                peak = runningCapital;
            }
            const drawdown = ((peak - runningCapital) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }

        const returns = allTrades.map((t) => t.pnlPercent);
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const returnStdDev = Math.sqrt(
            returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
        );
        const sharpeRatio = returnStdDev > 0 ? (avgReturn - 0.02) / returnStdDev : 0;

        return {
            totalTrades,
            winRate,
            totalReturn,
            totalReturnPercent,
            averageReturn,
            maxDrawdown,
            sharpeRatio,
            profitFactor,
            grossProfit,
            grossLoss,
        };
    }

    /**
     * Display backtest results
     */
    displayResults(overall, symbolResults) {
        logger.info("⚙️ CONFIGURABLE BACKTEST RESULTS");
        logger.info("=".repeat(60));

        logger.info(`Initial Capital: $${this.initialCapital.toLocaleString()}`);
        logger.info(`Final Capital: $${this.currentCapital.toLocaleString()}`);
        logger.info(`Total Return: $${overall.totalReturn.toFixed(2)} (${overall.totalReturnPercent.toFixed(2)}%)`);
        logger.info(`Total Trades: ${overall.totalTrades}`);
        logger.info(`Win Rate: ${overall.winRate.toFixed(1)}%`);
        logger.info(`Average Return per Trade: $${overall.averageReturn.toFixed(2)}`);
        logger.info(`Maximum Drawdown: ${overall.maxDrawdown.toFixed(2)}%`);
        logger.info(`Profit Factor: ${overall.profitFactor.toFixed(2)}`);
        logger.info(`Sharpe Ratio: ${overall.sharpeRatio.toFixed(2)}`);

        logger.info("\n📈 Performance by Symbol:");
        symbolResults.forEach((result) => {
            const timeframeInfo = `${result.timeframe.barSize} bars`;
            if (result.totalTrades > 0) {
                const winRate = (result.winningTrades / result.totalTrades) * 100;
                logger.info(`${result.symbol} (${result.dataSource}, ${timeframeInfo}): ${result.totalTrades} trades, ${winRate.toFixed(1)}% win rate, $${result.totalReturn.toFixed(2)} return`);
            } else {
                logger.info(`${result.symbol} (${result.dataSource}, ${timeframeInfo}): No trades generated from ${result.barsProcessed} bars`);
            }
        });

        logger.info("=".repeat(60));
    }

    /**
     * Export results to JSON file
     */
    exportResults(results) {
        const exportData = {
            timestamp: new Date().toISOString(),
            type: "CONFIGURABLE_BACKTEST",
            config: this.config,
            results: results,
            trades: this.trades,
        };

        const filename = `configurable-backtest-results-${Date.now()}.json`;
        const filepath = path.join("logs", filename);

        if (!fs.existsSync("logs")) {
            fs.mkdirSync("logs", { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
        logger.info(`📁 Results exported to: ${filepath}`);
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    // You can override timeframe here
    const customTimeframe = process.argv[2] && process.argv[3] ? {
        period: process.argv[2],
        barSize: process.argv[3]
    } : null;

    const backtester = new ConfigurableBacktester(customTimeframe);

    try {
        logger.info("⚙️ Starting CONFIGURABLE Real Data Backtesting System...");
        if (customTimeframe) {
            logger.info(`🎯 Using custom timeframe: ${customTimeframe.period}/${customTimeframe.barSize}`);
        }

        const results = await backtester.runConfigurableBacktest();
        backtester.exportResults(results);

        logger.info("✅ Configurable backtest completed successfully!");

        logger.info("\n💡 Timeframe Options:");
        logger.info("• Edit config/trading-config.json to set default timeframes");
        logger.info("• Use command line: npm run configurable-backtest 1m 5min");
        logger.info("• Available bar sizes: 1min, 5min, 15min, 30min, 1h, 1d");

    } catch (error) {
        logger.error("❌ Configurable backtest failed:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { ConfigurableBacktester };
