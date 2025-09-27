/**
 * Backtesting framework for momentum strategy
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MomentumStrategy } from '../src/momentum-strategy.js';
import { logger } from '../src/logger.js';

// Load environment variables
dotenv.config();

class Backtester {
    constructor() {
        this.config = this.loadConfig();
        this.strategy = new MomentumStrategy(this.config);
        this.initialCapital = this.config.backtesting.initialCapital || 100000;
        this.currentCapital = this.initialCapital;
        this.positions = new Map();
        this.trades = [];
        this.dailyReturns = [];
    }
    
    loadConfig() {
        const configPath = path.join(process.cwd(), 'config', 'trading-config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    /**
     * Generate synthetic historical data for backtesting
     * In a real implementation, you would load actual historical data
     */
    generateSyntheticData(symbol, days = 252) {
        const data = [];
        let price = 100 + (Math.random() * 100); // Starting price between $100-200
        
        for (let i = 0; i < days; i++) {
            // Generate realistic price movement
            const dailyReturn = (Math.random() - 0.5) * 0.04; // ±2% daily movement
            const trendFactor = Math.sin(i / 50) * 0.001; // Long-term trend
            const volatilityFactor = 0.5 + (Math.random() * 0.5); // Variable volatility
            
            price = price * (1 + (dailyReturn * volatilityFactor) + trendFactor);
            
            // Ensure price doesn't go negative
            price = Math.max(price, 1);
            
            const volume = Math.floor(500000 + (Math.random() * 2000000));
            
            data.push({
                date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
                open: price * (0.99 + Math.random() * 0.02),
                high: price * (1 + Math.random() * 0.02),
                low: price * (0.98 + Math.random() * 0.02),
                close: price,
                volume: volume
            });
        }
        
        return data;
    }
    
    /**
     * Run backtest on a single symbol
     */
    backtestSymbol(symbol, historicalData) {
        logger.info(`📊 Backtesting ${symbol}...`);
        
        const results = {
            symbol,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalReturn: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            trades: []
        };
        
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
                low: candle.low
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
                const exitSignal = this.strategy.checkExitSignal(symbol, position, marketData);
                
                if (exitSignal.signal !== 'HOLD') {
                    this.exitPosition(symbol, candle, exitSignal.reason, results);
                }
            }
        }
        
        // Close any remaining positions
        if (this.positions.has(symbol)) {
            const lastCandle = historicalData[historicalData.length - 1];
            this.exitPosition(symbol, lastCandle, 'End of backtest', results);
        }
        
        return results;
    }
    
    /**
     * Enter a position
     */
    enterPosition(symbol, analysis, candle, results) {
        const entryPrice = candle.close;
        const positionSize = this.strategy.calculatePositionSize(symbol, entryPrice, this.currentCapital);
        
        if (positionSize < 1) return;
        
        const exitLevels = this.strategy.calculateExitLevels(analysis.signal, entryPrice);
        const positionValue = positionSize * entryPrice;
        
        // Check if we have enough capital
        if (positionValue > this.currentCapital * 0.2) {
            return; // Position too large
        }
        
        const position = {
            side: analysis.signal,
            quantity: positionSize,
            entryPrice: entryPrice,
            entryDate: candle.date,
            stopLoss: exitLevels.stopLoss,
            takeProfit: exitLevels.takeProfit,
            analysis: analysis
        };
        
        this.positions.set(symbol, position);
        this.currentCapital -= positionValue; // Reduce available capital
        
        logger.debug(`📈 Entered ${analysis.signal} position: ${symbol} @ $${entryPrice.toFixed(2)}`);
    }
    
    /**
     * Exit a position
     */
    exitPosition(symbol, candle, reason, results) {
        const position = this.positions.get(symbol);
        if (!position) return;
        
        const exitPrice = candle.close;
        const positionValue = position.quantity * position.entryPrice;
        
        // Calculate P&L
        let pnl;
        if (position.side === 'BUY') {
            pnl = (exitPrice - position.entryPrice) * position.quantity;
        } else {
            pnl = (position.entryPrice - exitPrice) * position.quantity;
        }
        
        // Update capital
        this.currentCapital += positionValue + pnl;
        
        // Record trade
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
            holdingDays: Math.floor((candle.date - position.entryDate) / (1000 * 60 * 60 * 24))
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
        
        logger.debug(`📉 Exited position: ${symbol} @ $${exitPrice.toFixed(2)} - P&L: $${pnl.toFixed(2)} (${reason})`);
    }
    
    /**
     * Run comprehensive backtest
     */
    async runBacktest() {
        logger.info('🚀 Starting momentum strategy backtest...');
        
        const testSymbols = this.config.watchlist.slice(0, 5); // Test first 5 symbols
        const results = [];
        
        for (const symbol of testSymbols) {
            try {
                // Generate synthetic historical data
                const historicalData = this.generateSyntheticData(symbol, 252); // 1 year
                
                // Run backtest
                const symbolResults = this.backtestSymbol(symbol, historicalData);
                results.push(symbolResults);
                
            } catch (error) {
                logger.error(`Error backtesting ${symbol}:`, error);
            }
        }
        
        // Calculate overall performance
        const overallResults = this.calculateOverallPerformance(results);
        this.displayResults(overallResults, results);
        
        return { overall: overallResults, bySymbol: results };
    }
    
    /**
     * Calculate overall performance metrics
     */
    calculateOverallPerformance(symbolResults) {
        const allTrades = symbolResults.flatMap(r => r.trades);
        
        if (allTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                averageReturn: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                profitFactor: 0
            };
        }
        
        const totalTrades = allTrades.length;
        const winningTrades = allTrades.filter(t => t.pnl > 0);
        const losingTrades = allTrades.filter(t => t.pnl <= 0);
        
        const totalReturn = allTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalReturnPercent = (totalReturn / this.initialCapital) * 100;
        const averageReturn = totalReturn / totalTrades;
        
        const winRate = (winningTrades.length / totalTrades) * 100;
        
        // Calculate profit factor
        const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        
        // Calculate maximum drawdown
        let peak = this.initialCapital;
        let maxDrawdown = 0;
        let runningCapital = this.initialCapital;
        
        for (const trade of allTrades) {
            runningCapital += trade.pnl;
            if (runningCapital > peak) {
                peak = runningCapital;
            }
            const drawdown = (peak - runningCapital) / peak * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        
        // Simple Sharpe ratio calculation (assuming 2% risk-free rate)
        const returns = allTrades.map(t => t.pnlPercent);
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
            grossLoss
        };
    }
    
    /**
     * Display backtest results
     */
    displayResults(overall, symbolResults) {
        logger.info('\n📊 BACKTEST RESULTS');
        logger.info('=' .repeat(60));
        
        logger.info(`Initial Capital: $${this.initialCapital.toLocaleString()}`);
        logger.info(`Final Capital: $${this.currentCapital.toLocaleString()}`);
        logger.info(`Total Return: $${overall.totalReturn.toFixed(2)} (${overall.totalReturnPercent.toFixed(2)}%)`);
        logger.info(`Total Trades: ${overall.totalTrades}`);
        logger.info(`Win Rate: ${overall.winRate.toFixed(1)}%`);
        logger.info(`Average Return per Trade: $${overall.averageReturn.toFixed(2)}`);
        logger.info(`Maximum Drawdown: ${overall.maxDrawdown.toFixed(2)}%`);
        logger.info(`Profit Factor: ${overall.profitFactor.toFixed(2)}`);
        logger.info(`Sharpe Ratio: ${overall.sharpeRatio.toFixed(2)}`);
        
        logger.info('\n📈 Performance by Symbol:');
        symbolResults.forEach(result => {
            if (result.totalTrades > 0) {
                const winRate = (result.winningTrades / result.totalTrades) * 100;
                logger.info(`${result.symbol}: ${result.totalTrades} trades, ${winRate.toFixed(1)}% win rate, $${result.totalReturn.toFixed(2)} return`);
            }
        });
        
        // Show best and worst trades
        const allTrades = symbolResults.flatMap(r => r.trades);
        if (allTrades.length > 0) {
            const bestTrade = allTrades.reduce((best, trade) => trade.pnl > best.pnl ? trade : best);
            const worstTrade = allTrades.reduce((worst, trade) => trade.pnl < worst.pnl ? trade : worst);
            
            logger.info('\n🏆 Best Trade:');
            logger.info(`${bestTrade.symbol}: ${bestTrade.side} $${bestTrade.pnl.toFixed(2)} (${bestTrade.pnlPercent.toFixed(2)}%)`);
            
            logger.info('\n💸 Worst Trade:');
            logger.info(`${worstTrade.symbol}: ${worstTrade.side} $${worstTrade.pnl.toFixed(2)} (${worstTrade.pnlPercent.toFixed(2)}%)`);
        }
        
        logger.info('=' .repeat(60));
    }
    
    /**
     * Export results to JSON file
     */
    exportResults(results) {
        const exportData = {
            timestamp: new Date().toISOString(),
            config: this.config,
            results: results,
            trades: this.trades
        };
        
        const filename = `backtest-results-${Date.now()}.json`;
        const filepath = path.join('logs', filename);
        
        // Ensure logs directory exists
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs', { recursive: true });
        }
        
        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
        logger.info(`📁 Results exported to: ${filepath}`);
    }
}

// Main execution
async function main() {
    const backtester = new Backtester();
    
    try {
        const results = await backtester.runBacktest();
        backtester.exportResults(results);
        
        logger.info('✅ Backtest completed successfully');
        
    } catch (error) {
        logger.error('❌ Backtest failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { Backtester };
