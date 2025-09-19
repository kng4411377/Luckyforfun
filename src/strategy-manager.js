/**
 * Strategy Manager
 * 
 * Manages multiple trading strategies with dynamic loading/unloading,
 * configuration management, and execution coordination.
 */

import fs from 'fs';
import path from 'path';
import { logger, TradingLogger } from './logger.js';

export class StrategyManager {
    constructor() {
        this.strategies = new Map(); // Active strategies
        this.strategyConfigs = new Map(); // Strategy configurations
        this.availableStrategies = new Map(); // Available strategy classes
        this.performanceMetrics = new Map(); // Strategy performance tracking
        
        // Strategy execution settings
        this.executionOrder = []; // Order of strategy execution
        this.globalConfig = {};
    }
    
    /**
     * Initialize the strategy manager
     */
    async initialize(globalConfig = {}) {
        this.globalConfig = globalConfig;
        logger.info('🎯 Initializing Strategy Manager...');
        
        // Discover available strategies
        await this.discoverStrategies();
        
        // Load enabled strategies from configuration
        await this.loadEnabledStrategies();
        
        logger.info(`✅ Strategy Manager initialized with ${this.strategies.size} active strategies`);
    }
    
    /**
     * Discover available strategy classes
     */
    async discoverStrategies() {
        const strategiesDir = path.join(process.cwd(), 'strategies');
        
        try {
            // Check if strategies directory exists
            if (!fs.existsSync(strategiesDir)) {
                logger.info('📁 Creating strategies directory...');
                fs.mkdirSync(strategiesDir, { recursive: true });
            }
            
            // Scan for strategy files
            const files = fs.readdirSync(strategiesDir);
            const strategyFiles = files.filter(file => file.endsWith('-strategy.js'));
            
            for (const file of strategyFiles) {
                try {
                    const strategyPath = path.join(strategiesDir, file);
                    const strategyModule = await import(`file://${strategyPath}`);
                    
                    // Extract strategy class (assume default export or named export)
                    const StrategyClass = strategyModule.default || Object.values(strategyModule)[0];
                    
                    if (StrategyClass && typeof StrategyClass === 'function') {
                        const strategyName = file.replace('-strategy.js', '');
                        this.availableStrategies.set(strategyName, StrategyClass);
                        logger.info(`📋 Discovered strategy: ${strategyName}`);
                    }
                } catch (error) {
                    logger.warn(`⚠️ Failed to load strategy ${file}:`, error.message);
                }
            }
            
            // Also register built-in strategies
            await this.registerBuiltInStrategies();
            
        } catch (error) {
            logger.error('❌ Failed to discover strategies:', error);
        }
    }
    
    /**
     * Register built-in strategies
     */
    async registerBuiltInStrategies() {
        try {
            // Register momentum strategy
            const { MomentumStrategy } = await import('./momentum-strategy.js');
            this.availableStrategies.set('momentum', MomentumStrategy);
            logger.info('📋 Registered built-in strategy: momentum');
        } catch (error) {
            logger.warn('⚠️ Failed to register built-in strategies:', error.message);
        }
    }
    
    /**
     * Load enabled strategies from configuration
     */
    async loadEnabledStrategies() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'strategies.json');
            
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                
                for (const strategyConfig of config.enabled || []) {
                    await this.attachStrategy(strategyConfig.name, strategyConfig.config);
                }
            } else {
                // Create default strategies configuration
                await this.createDefaultStrategiesConfig();
            }
        } catch (error) {
            logger.error('❌ Failed to load enabled strategies:', error);
        }
    }
    
    /**
     * Create default strategies configuration
     */
    async createDefaultStrategiesConfig() {
        const defaultConfig = {
            enabled: [
                {
                    name: 'momentum',
                    config: {
                        enabled: false,
                        priority: 1,
                        allocation: 0.5 // 50% of available capital
                    }
                }
            ],
            global: {
                maxConcurrentStrategies: 3,
                riskAllocation: {
                    conservative: 0.3,
                    moderate: 0.5,
                    aggressive: 0.2
                }
            }
        };
        
        const configPath = path.join(process.cwd(), 'config', 'strategies.json');
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.info('📄 Created default strategies configuration');
    }
    
    /**
     * Attach a strategy to the manager
     */
    async attachStrategy(strategyName, config = {}) {
        try {
            if (this.strategies.has(strategyName)) {
                logger.warn(`⚠️ Strategy '${strategyName}' is already attached`);
                return false;
            }
            
            const StrategyClass = this.availableStrategies.get(strategyName);
            if (!StrategyClass) {
                throw new Error(`Strategy '${strategyName}' not found in available strategies`);
            }
            
            // Merge with global config
            const strategyConfig = {
                ...this.globalConfig,
                ...config
            };
            
            // Create strategy instance
            const strategy = new StrategyClass(strategyConfig);
            
            // Validate configuration
            strategy.validateConfig();
            
            // Initialize strategy
            await strategy.initialize();
            
            // Store strategy and configuration
            this.strategies.set(strategyName, strategy);
            this.strategyConfigs.set(strategyName, strategyConfig);
            
            // Add to execution order
            const priority = config.priority || 1;
            this.executionOrder.push({ name: strategyName, priority });
            this.executionOrder.sort((a, b) => a.priority - b.priority);
            
            // Initialize performance tracking
            this.performanceMetrics.set(strategyName, {
                attached: Date.now(),
                totalSignals: 0,
                totalTrades: 0,
                performance: 0
            });
            
            TradingLogger.logStrategy(`Attached strategy: ${strategyName}`, { config: strategyConfig });
            logger.info(`✅ Strategy '${strategyName}' attached successfully`);
            
            return true;
            
        } catch (error) {
            logger.error(`❌ Failed to attach strategy '${strategyName}':`, error);
            return false;
        }
    }
    
    /**
     * Detach a strategy from the manager
     */
    async detachStrategy(strategyName) {
        try {
            const strategy = this.strategies.get(strategyName);
            if (!strategy) {
                logger.warn(`⚠️ Strategy '${strategyName}' is not attached`);
                return false;
            }
            
            // Cleanup strategy resources
            await strategy.cleanup();
            
            // Remove from collections
            this.strategies.delete(strategyName);
            this.strategyConfigs.delete(strategyName);
            this.performanceMetrics.delete(strategyName);
            
            // Remove from execution order
            this.executionOrder = this.executionOrder.filter(item => item.name !== strategyName);
            
            TradingLogger.logStrategy(`Detached strategy: ${strategyName}`);
            logger.info(`✅ Strategy '${strategyName}' detached successfully`);
            
            return true;
            
        } catch (error) {
            logger.error(`❌ Failed to detach strategy '${strategyName}':`, error);
            return false;
        }
    }
    
    /**
     * Get list of available strategies
     */
    getAvailableStrategies() {
        return Array.from(this.availableStrategies.keys());
    }
    
    /**
     * Get list of active strategies
     */
    getActiveStrategies() {
        return Array.from(this.strategies.keys());
    }
    
    /**
     * Get strategy instance
     */
    getStrategy(strategyName) {
        return this.strategies.get(strategyName);
    }
    
    /**
     * Update strategy configuration
     */
    async updateStrategyConfig(strategyName, newConfig) {
        try {
            const strategy = this.strategies.get(strategyName);
            if (!strategy) {
                throw new Error(`Strategy '${strategyName}' is not attached`);
            }
            
            // Update strategy configuration
            const currentConfig = this.strategyConfigs.get(strategyName);
            const updatedConfig = { ...currentConfig, ...newConfig };
            
            strategy.updateConfig(updatedConfig);
            this.strategyConfigs.set(strategyName, updatedConfig);
            
            TradingLogger.logStrategy(`Updated configuration for strategy: ${strategyName}`, { config: newConfig });
            logger.info(`✅ Configuration updated for strategy '${strategyName}'`);
            
            return true;
            
        } catch (error) {
            logger.error(`❌ Failed to update configuration for strategy '${strategyName}':`, error);
            return false;
        }
    }
    
    /**
     * Analyze symbols across all active strategies
     */
    async analyzeSymbols(symbols, marketData) {
        const results = new Map();
        
        for (const { name } of this.executionOrder) {
            const strategy = this.strategies.get(name);
            if (!strategy) continue;
            
            const strategyResults = new Map();
            
            for (const symbol of symbols) {
                try {
                    if (marketData[symbol] && !marketData[symbol].error) {
                        // Update price history
                        strategy.updatePriceHistory(
                            symbol, 
                            marketData[symbol].lastPrice, 
                            marketData[symbol].volume || 0
                        );
                        
                        // Get analysis
                        const analysis = strategy.analyze(symbol, marketData[symbol]);
                        strategyResults.set(symbol, analysis);
                        
                        // Update performance metrics
                        if (analysis.signal !== 'HOLD') {
                            this.updateStrategyMetrics(name, 'signal');
                        }
                    }
                } catch (error) {
                    logger.error(`Error analyzing ${symbol} with strategy ${name}:`, error);
                }
            }
            
            results.set(name, strategyResults);
        }
        
        return results;
    }
    
    /**
     * Get consolidated signals from all strategies
     */
    getConsolidatedSignals(analysisResults) {
        const consolidatedSignals = new Map();
        
        // Collect all signals for each symbol
        for (const [strategyName, strategyResults] of analysisResults) {
            for (const [symbol, analysis] of strategyResults) {
                if (!consolidatedSignals.has(symbol)) {
                    consolidatedSignals.set(symbol, []);
                }
                
                consolidatedSignals.get(symbol).push({
                    strategy: strategyName,
                    signal: analysis.signal,
                    strength: analysis.strength,
                    reason: analysis.reason,
                    data: analysis.data
                });
            }
        }
        
        // Consolidate signals using voting or weighted approach
        const finalSignals = new Map();
        
        for (const [symbol, signals] of consolidatedSignals) {
            const consolidatedSignal = this.consolidateSignalsForSymbol(signals);
            if (consolidatedSignal.signal !== 'HOLD') {
                finalSignals.set(symbol, consolidatedSignal);
            }
        }
        
        return finalSignals;
    }
    
    /**
     * Consolidate signals for a single symbol
     */
    consolidateSignalsForSymbol(signals) {
        if (signals.length === 0) {
            return { signal: 'HOLD', strength: 0, reason: 'No signals' };
        }
        
        if (signals.length === 1) {
            return signals[0];
        }
        
        // Weighted voting based on signal strength
        let buyWeight = 0;
        let sellWeight = 0;
        let totalWeight = 0;
        const reasons = [];
        
        for (const signal of signals) {
            const weight = signal.strength / 100;
            totalWeight += weight;
            
            if (signal.signal === 'BUY') {
                buyWeight += weight;
            } else if (signal.signal === 'SELL') {
                sellWeight += weight;
            }
            
            reasons.push(`${signal.strategy}: ${signal.reason}`);
        }
        
        // Determine final signal
        let finalSignal = 'HOLD';
        let finalStrength = 0;
        
        if (buyWeight > sellWeight && buyWeight > totalWeight * 0.6) {
            finalSignal = 'BUY';
            finalStrength = (buyWeight / totalWeight) * 100;
        } else if (sellWeight > buyWeight && sellWeight > totalWeight * 0.6) {
            finalSignal = 'SELL';
            finalStrength = (sellWeight / totalWeight) * 100;
        }
        
        return {
            signal: finalSignal,
            strength: finalStrength,
            reason: `Consolidated: ${reasons.join('; ')}`,
            strategies: signals.map(s => s.strategy)
        };
    }
    
    /**
     * Update strategy performance metrics
     */
    updateStrategyMetrics(strategyName, event) {
        const metrics = this.performanceMetrics.get(strategyName);
        if (!metrics) return;
        
        switch (event) {
            case 'signal':
                metrics.totalSignals++;
                break;
            case 'trade':
                metrics.totalTrades++;
                break;
        }
        
        metrics.lastUpdate = Date.now();
    }
    
    /**
     * Get performance metrics for all strategies
     */
    getPerformanceMetrics() {
        const metrics = {};
        
        for (const [name, strategy] of this.strategies) {
            const strategyMetrics = this.performanceMetrics.get(name);
            const strategyPerformance = strategy.getPerformanceMetrics();
            
            metrics[name] = {
                ...strategyMetrics,
                ...strategyPerformance
            };
        }
        
        return metrics;
    }
    
    /**
     * Health check for all strategies
     */
    async healthCheck() {
        const healthStatus = {
            overall: 'healthy',
            strategies: {},
            timestamp: Date.now()
        };
        
        for (const [name, strategy] of this.strategies) {
            try {
                const strategyHealth = await strategy.healthCheck();
                healthStatus.strategies[name] = strategyHealth;
                
                if (strategyHealth.status !== 'healthy') {
                    healthStatus.overall = 'degraded';
                }
            } catch (error) {
                healthStatus.strategies[name] = {
                    status: 'error',
                    error: error.message
                };
                healthStatus.overall = 'unhealthy';
            }
        }
        
        return healthStatus;
    }
    
    /**
     * Save current strategy configuration
     */
    async saveConfiguration() {
        try {
            const config = {
                enabled: [],
                global: this.globalConfig
            };
            
            for (const [name, strategyConfig] of this.strategyConfigs) {
                config.enabled.push({
                    name,
                    config: strategyConfig
                });
            }
            
            const configPath = path.join(process.cwd(), 'config', 'strategies.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            logger.info('💾 Strategy configuration saved');
            return true;
            
        } catch (error) {
            logger.error('❌ Failed to save strategy configuration:', error);
            return false;
        }
    }
    
    /**
     * Cleanup all strategies
     */
    async cleanup() {
        logger.info('🧹 Cleaning up Strategy Manager...');
        
        for (const [name, strategy] of this.strategies) {
            try {
                await strategy.cleanup();
                logger.info(`✅ Cleaned up strategy: ${name}`);
            } catch (error) {
                logger.error(`❌ Failed to cleanup strategy ${name}:`, error);
            }
        }
        
        this.strategies.clear();
        this.strategyConfigs.clear();
        this.performanceMetrics.clear();
        this.executionOrder = [];
        
        logger.info('✅ Strategy Manager cleanup completed');
    }
}
