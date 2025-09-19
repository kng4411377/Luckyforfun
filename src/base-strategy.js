/**
 * Base Strategy Interface
 * 
 * All trading strategies must extend this base class to ensure
 * consistent interface and behavior across different strategies.
 */

export class BaseStrategy {
    constructor(name, config) {
        if (this.constructor === BaseStrategy) {
            throw new Error('BaseStrategy is an abstract class and cannot be instantiated directly');
        }
        
        this.name = name;
        this.config = config;
        this.positions = new Map();
        this.priceHistory = new Map();
        this.signals = new Map();
        this.metadata = {
            version: '1.0.0',
            author: 'Unknown',
            description: 'Base strategy implementation',
            timeframe: '5m',
            riskLevel: 'medium'
        };
    }
    
    /**
     * Initialize the strategy
     * Override this method to perform strategy-specific initialization
     */
    async initialize() {
        // Default implementation - override in subclasses
        return true;
    }
    
    /**
     * Update price history for a symbol
     * This method is standardized across all strategies
     */
    updatePriceHistory(symbol, price, volume, timestamp = Date.now()) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }
        
        const history = this.priceHistory.get(symbol);
        history.push({ price, volume, timestamp });
        
        // Keep only required history length (strategy-specific)
        const maxHistory = this.getMaxHistoryLength();
        if (history.length > maxHistory) {
            history.splice(0, history.length - maxHistory);
        }
    }
    
    /**
     * Get maximum history length required by the strategy
     * Override this method in subclasses
     */
    getMaxHistoryLength() {
        return 100; // Default 100 data points
    }
    
    /**
     * Analyze a symbol for trading signals
     * MUST be implemented by subclasses
     */
    analyze(symbol, marketData) {
        throw new Error('analyze() method must be implemented by strategy subclass');
    }
    
    /**
     * Calculate position size based on risk management
     * MUST be implemented by subclasses
     */
    calculatePositionSize(symbol, price, accountValue) {
        throw new Error('calculatePositionSize() method must be implemented by strategy subclass');
    }
    
    /**
     * Calculate stop loss and take profit levels
     * MUST be implemented by subclasses
     */
    calculateExitLevels(signal, entryPrice) {
        throw new Error('calculateExitLevels() method must be implemented by strategy subclass');
    }
    
    /**
     * Check if we should exit an existing position
     * MUST be implemented by subclasses
     */
    checkExitSignal(symbol, position, marketData) {
        throw new Error('checkExitSignal() method must be implemented by strategy subclass');
    }
    
    /**
     * Get strategy metadata
     */
    getMetadata() {
        return this.metadata;
    }
    
    /**
     * Get strategy configuration
     */
    getConfig() {
        return this.config;
    }
    
    /**
     * Update strategy configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * Get current positions
     */
    getPositions() {
        return this.positions;
    }
    
    /**
     * Add a new position
     */
    addPosition(symbol, position) {
        this.positions.set(symbol, {
            ...position,
            timestamp: Date.now(),
            strategy: this.name
        });
    }
    
    /**
     * Remove a position
     */
    removePosition(symbol) {
        return this.positions.delete(symbol);
    }
    
    /**
     * Get position for a symbol
     */
    getPosition(symbol) {
        return this.positions.get(symbol);
    }
    
    /**
     * Check if strategy has position for symbol
     */
    hasPosition(symbol) {
        return this.positions.has(symbol);
    }
    
    /**
     * Get price history for a symbol
     */
    getPriceHistory(symbol) {
        return this.priceHistory.get(symbol) || [];
    }
    
    /**
     * Clear all data (positions, history, signals)
     */
    reset() {
        this.positions.clear();
        this.priceHistory.clear();
        this.signals.clear();
    }
    
    /**
     * Validate strategy configuration
     * Override this method to add strategy-specific validation
     */
    validateConfig() {
        if (!this.config) {
            throw new Error('Strategy configuration is required');
        }
        return true;
    }
    
    /**
     * Get strategy performance metrics
     * Override this method to provide strategy-specific metrics
     */
    getPerformanceMetrics() {
        const positions = Array.from(this.positions.values());
        return {
            totalPositions: positions.length,
            activePositions: positions.filter(p => p.status === 'active').length,
            strategy: this.name,
            lastUpdate: Date.now()
        };
    }
    
    /**
     * Strategy health check
     * Override this method to add strategy-specific health checks
     */
    healthCheck() {
        return {
            status: 'healthy',
            strategy: this.name,
            positions: this.positions.size,
            timestamp: Date.now()
        };
    }
    
    /**
     * Cleanup resources when strategy is detached
     * Override this method to perform strategy-specific cleanup
     */
    async cleanup() {
        this.reset();
        return true;
    }
}
