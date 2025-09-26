/**
 * Adaptive Strategy Selector
 * 
 * Intelligent system that selects and manages trading strategies based on:
 * 1. Current market conditions (via MarketAnalyzer)
 * 2. Strategy performance tracking
 * 3. Risk management
 * 4. Dynamic allocation adjustments
 */

import { MarketAnalyzer } from './market-analyzer.js';
import { logger } from './logger.js';

export class AdaptiveStrategySelector {
    constructor(marketDataClient, strategyManager) {
        this.marketDataClient = marketDataClient;
        this.strategyManager = strategyManager;
        this.marketAnalyzer = new MarketAnalyzer(marketDataClient);
        
        // Performance tracking
        this.strategyPerformance = new Map();
        this.performanceHistory = [];
        
        // Selection parameters
        this.minConfidenceThreshold = 0.4;
        this.performanceWindow = 20; // Number of trades to consider for performance
        this.rebalanceThreshold = 0.2; // Minimum allocation change to trigger rebalance
        
        // Current state
        this.currentAllocation = new Map();
        this.lastRegimeChange = null;
        this.adaptationHistory = [];
        
        this.initializePerformanceTracking();
    }

    /**
     * Initialize performance tracking for all available strategies
     */
    initializePerformanceTracking() {
        const availableStrategies = this.strategyManager.getAvailableStrategies();
        
        for (const strategyName of availableStrategies) {
            this.strategyPerformance.set(strategyName, {
                totalTrades: 0,
                winningTrades: 0,
                totalPnL: 0,
                avgWin: 0,
                avgLoss: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                winRate: 0,
                profitFactor: 0,
                recentTrades: [],
                lastUpdate: Date.now(),
                regimePerformance: new Map() // Performance by market regime
            });
        }
    }

    /**
     * Main method: Analyze market and select optimal strategies
     */
    async selectOptimalStrategies() {
        try {
            logger.info('🧠 Starting adaptive strategy selection...');

            // Step 1: Analyze current market conditions
            const marketAnalysis = await this.marketAnalyzer.analyzeMarketConditions();
            
            // Step 2: Get base strategy recommendations from market analysis
            const baseRecommendations = marketAnalysis.recommendedStrategies;
            
            // Step 3: Adjust recommendations based on strategy performance
            const performanceAdjustedStrategies = this.adjustForPerformance(
                baseRecommendations, 
                marketAnalysis.regime
            );
            
            // Step 4: Apply risk management and diversification
            const finalStrategies = this.applyRiskManagement(performanceAdjustedStrategies);
            
            // Step 5: Check if rebalancing is needed
            const rebalanceNeeded = this.shouldRebalance(finalStrategies, marketAnalysis);
            
            if (rebalanceNeeded) {
                logger.info('🔄 Strategy rebalancing triggered');
                await this.executeStrategyChanges(finalStrategies, marketAnalysis);
            } else {
                logger.info('✅ Current strategy allocation remains optimal');
            }

            // Step 6: Record the adaptation decision
            this.recordAdaptation(marketAnalysis, finalStrategies, rebalanceNeeded);
            
            return {
                marketAnalysis,
                recommendedStrategies: finalStrategies,
                rebalanceExecuted: rebalanceNeeded,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error('❌ Error in adaptive strategy selection:', error);
            return this.getFailsafeSelection();
        }
    }

    /**
     * Adjust strategy recommendations based on historical performance
     */
    adjustForPerformance(baseRecommendations, currentRegime) {
        const adjustedStrategies = [];

        for (const strategy of baseRecommendations) {
            const performance = this.strategyPerformance.get(strategy.name);
            
            if (!performance) {
                // New strategy, use base allocation
                adjustedStrategies.push({ ...strategy, performanceScore: 0.5 });
                continue;
            }

            // Calculate performance score for current regime
            const regimePerf = performance.regimePerformance.get(currentRegime) || {
                winRate: 0.5,
                avgReturn: 0,
                tradeCount: 0
            };

            // Overall performance metrics
            const overallWinRate = performance.winRate || 0.5;
            const recentPerformance = this.calculateRecentPerformance(performance.recentTrades);
            const sharpeRatio = performance.sharpeRatio || 0;

            // Combine metrics into performance score (0-1)
            let performanceScore = (
                overallWinRate * 0.3 +
                (recentPerformance + 1) / 2 * 0.3 + // Normalize to 0-1
                Math.min(Math.max(sharpeRatio + 1, 0) / 2, 1) * 0.2 +
                Math.min(regimePerf.winRate, 1) * 0.2
            );

            // Penalize strategies with very few trades (lack of data)
            if (performance.totalTrades < 10) {
                performanceScore *= 0.7;
            }

            // Adjust allocation based on performance
            let adjustedAllocation = strategy.allocation * performanceScore;

            // Ensure minimum allocation for diversification
            adjustedAllocation = Math.max(adjustedAllocation, 0.05);

            adjustedStrategies.push({
                ...strategy,
                allocation: adjustedAllocation,
                performanceScore,
                originalAllocation: strategy.allocation
            });
        }

        // Normalize allocations to sum to 1.0
        const totalAllocation = adjustedStrategies.reduce((sum, s) => sum + s.allocation, 0);
        adjustedStrategies.forEach(s => {
            s.allocation = s.allocation / totalAllocation;
        });

        return adjustedStrategies;
    }

    /**
     * Apply risk management rules
     */
    applyRiskManagement(strategies) {
        const riskAdjustedStrategies = [...strategies];

        // Rule 1: Maximum single strategy allocation (40%)
        riskAdjustedStrategies.forEach(strategy => {
            strategy.allocation = Math.min(strategy.allocation, 0.4);
        });

        // Rule 2: Minimum number of strategies (2)
        if (riskAdjustedStrategies.length < 2) {
            // Add a conservative strategy
            riskAdjustedStrategies.push({
                name: 'random-walk-passive',
                priority: 99,
                allocation: 0.2,
                performanceScore: 0.5
            });
        }

        // Rule 3: Ensure at least one mean-reversion strategy for balance
        const hasMeanReversion = riskAdjustedStrategies.some(s => 
            s.name.includes('mean-reversion') || s.name.includes('rsi2')
        );

        if (!hasMeanReversion && riskAdjustedStrategies.length < 4) {
            riskAdjustedStrategies.push({
                name: 'mean-reversion',
                priority: 90,
                allocation: 0.15,
                performanceScore: 0.5
            });
        }

        // Re-normalize allocations
        const totalAllocation = riskAdjustedStrategies.reduce((sum, s) => sum + s.allocation, 0);
        riskAdjustedStrategies.forEach(s => {
            s.allocation = s.allocation / totalAllocation;
        });

        return riskAdjustedStrategies.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Check if rebalancing is needed
     */
    shouldRebalance(newStrategies, marketAnalysis) {
        // Always rebalance on regime change
        if (this.lastRegimeChange !== marketAnalysis.regime) {
            logger.info(`📊 Market regime changed: ${this.lastRegimeChange} → ${marketAnalysis.regime}`);
            this.lastRegimeChange = marketAnalysis.regime;
            return true;
        }

        // Check if allocation changes are significant
        for (const strategy of newStrategies) {
            const currentAllocation = this.currentAllocation.get(strategy.name) || 0;
            const allocationChange = Math.abs(strategy.allocation - currentAllocation);
            
            if (allocationChange > this.rebalanceThreshold) {
                logger.info(`📊 Significant allocation change for ${strategy.name}: ${currentAllocation.toFixed(2)} → ${strategy.allocation.toFixed(2)}`);
                return true;
            }
        }

        // Check if confidence is very high (>0.8) and different from current
        if (marketAnalysis.confidence > 0.8) {
            const activeStrategies = this.strategyManager.getActiveStrategies();
            const recommendedNames = newStrategies.map(s => s.name);
            
            if (!this.arraysEqual(activeStrategies.sort(), recommendedNames.sort())) {
                logger.info('📊 High confidence regime with different strategy mix');
                return true;
            }
        }

        return false;
    }

    /**
     * Execute strategy changes
     */
    async executeStrategyChanges(newStrategies, marketAnalysis) {
        try {
            logger.info('🔄 Executing strategy changes...');

            // Detach current strategies that are not in the new list
            const currentStrategies = this.strategyManager.getActiveStrategies();
            const newStrategyNames = newStrategies.map(s => s.name);

            for (const currentStrategy of currentStrategies) {
                if (!newStrategyNames.includes(currentStrategy)) {
                    logger.info(`➖ Detaching strategy: ${currentStrategy}`);
                    await this.strategyManager.detachStrategy(currentStrategy);
                }
            }

            // Attach and configure new strategies
            for (const strategy of newStrategies) {
                const isCurrentlyActive = currentStrategies.includes(strategy.name);
                
                if (!isCurrentlyActive) {
                    logger.info(`➕ Attaching strategy: ${strategy.name} (${(strategy.allocation * 100).toFixed(1)}%)`);
                    
                    // Create strategy configuration
                    const strategyConfig = this.createStrategyConfig(strategy, marketAnalysis);
                    
                    await this.strategyManager.attachStrategy(strategy.name, strategyConfig);
                } else {
                    // Update existing strategy allocation
                    logger.info(`🔧 Updating strategy: ${strategy.name} (${(strategy.allocation * 100).toFixed(1)}%)`);
                    // Note: This would require extending StrategyManager to support config updates
                }

                // Update current allocation tracking
                this.currentAllocation.set(strategy.name, strategy.allocation);
            }

            logger.info('✅ Strategy changes executed successfully');

        } catch (error) {
            logger.error('❌ Error executing strategy changes:', error);
            throw error;
        }
    }

    /**
     * Create strategy configuration based on market conditions
     */
    createStrategyConfig(strategy, marketAnalysis) {
        const baseConfig = {
            enabled: true,
            priority: strategy.priority,
            allocation: strategy.allocation
        };

        // Adjust parameters based on market regime
        switch (marketAnalysis.regime) {
            case 'TRENDING_BULL':
                return {
                    ...baseConfig,
                    riskManagement: {
                        maxPositionSize: 15000,
                        stopLossPercentage: 1.5,
                        takeProfitPercentage: 4.0
                    }
                };
                
            case 'TRENDING_BEAR':
                return {
                    ...baseConfig,
                    riskManagement: {
                        maxPositionSize: 8000,
                        stopLossPercentage: 2.5,
                        takeProfitPercentage: 2.0
                    }
                };
                
            case 'VOLATILE_SIDEWAYS':
                return {
                    ...baseConfig,
                    riskManagement: {
                        maxPositionSize: 10000,
                        stopLossPercentage: 2.0,
                        takeProfitPercentage: 2.5
                    }
                };
                
            case 'CRISIS_MODE':
                return {
                    ...baseConfig,
                    riskManagement: {
                        maxPositionSize: 5000,
                        stopLossPercentage: 3.0,
                        takeProfitPercentage: 1.5
                    }
                };
                
            default:
                return {
                    ...baseConfig,
                    riskManagement: {
                        maxPositionSize: 10000,
                        stopLossPercentage: 2.0,
                        takeProfitPercentage: 3.0
                    }
                };
        }
    }

    /**
     * Update strategy performance based on trade results
     */
    updateStrategyPerformance(strategyName, tradeResult) {
        const performance = this.strategyPerformance.get(strategyName);
        if (!performance) return;

        performance.totalTrades++;
        performance.totalPnL += tradeResult.pnl;

        if (tradeResult.pnl > 0) {
            performance.winningTrades++;
            performance.avgWin = (performance.avgWin * (performance.winningTrades - 1) + tradeResult.pnl) / performance.winningTrades;
        } else {
            performance.avgLoss = (performance.avgLoss * (performance.totalTrades - performance.winningTrades - 1) + Math.abs(tradeResult.pnl)) / (performance.totalTrades - performance.winningTrades);
        }

        performance.winRate = performance.winningTrades / performance.totalTrades;
        performance.profitFactor = performance.avgLoss > 0 ? performance.avgWin / performance.avgLoss : 0;

        // Add to recent trades
        performance.recentTrades.push({
            ...tradeResult,
            timestamp: Date.now()
        });

        // Keep only recent trades within window
        if (performance.recentTrades.length > this.performanceWindow) {
            performance.recentTrades = performance.recentTrades.slice(-this.performanceWindow);
        }

        performance.lastUpdate = Date.now();

        logger.info(`📊 Updated performance for ${strategyName}: WinRate=${(performance.winRate * 100).toFixed(1)}%, PnL=$${performance.totalPnL.toFixed(2)}`);
    }

    /**
     * Helper methods
     */
    calculateRecentPerformance(recentTrades) {
        if (recentTrades.length === 0) return 0;
        
        const totalPnL = recentTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        return totalPnL / recentTrades.length;
    }

    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }

    recordAdaptation(marketAnalysis, strategies, rebalanced) {
        const adaptation = {
            timestamp: Date.now(),
            marketRegime: marketAnalysis.regime,
            confidence: marketAnalysis.confidence,
            strategies: strategies.map(s => ({
                name: s.name,
                allocation: s.allocation,
                performanceScore: s.performanceScore
            })),
            rebalanced,
            marketConditions: {
                volatility: marketAnalysis.indicators.volatility.level,
                trend: marketAnalysis.indicators.trend.direction,
                momentum: marketAnalysis.indicators.momentum.type
            }
        };

        this.adaptationHistory.push(adaptation);
        
        // Keep only last 100 adaptations
        if (this.adaptationHistory.length > 100) {
            this.adaptationHistory = this.adaptationHistory.slice(-100);
        }
    }

    getFailsafeSelection() {
        return {
            marketAnalysis: this.marketAnalyzer.getDefaultAnalysis(),
            recommendedStrategies: [
                { name: 'momentum', priority: 1, allocation: 0.4 },
                { name: 'mean-reversion', priority: 2, allocation: 0.6 }
            ],
            rebalanceExecuted: false,
            timestamp: Date.now(),
            error: 'Failsafe selection activated'
        };
    }

    /**
     * Get current status and statistics
     */
    getStatus() {
        return {
            currentRegime: this.marketAnalyzer.getCurrentRegime(),
            activeStrategies: Array.from(this.currentAllocation.entries()).map(([name, allocation]) => ({
                name,
                allocation,
                performance: this.strategyPerformance.get(name)
            })),
            adaptationHistory: this.adaptationHistory.slice(-10),
            lastUpdate: Date.now()
        };
    }
}
