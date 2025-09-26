/**
 * Watchlist Manager
 * 
 * Centralized management system for trading watchlists with support for:
 * - Multiple watchlist configurations
 * - Dynamic watchlist switching
 * - Symbol validation and filtering
 * - Performance-based watchlist optimization
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

export class WatchlistManager {
    constructor() {
        this.watchlists = new Map();
        this.activeWatchlistName = 'default';
        this.configPath = path.join(process.cwd(), 'config', 'watchlists.json');
        this.symbolPerformance = new Map();
        this.lastUpdate = null;
    }

    /**
     * Initialize watchlist manager by loading configurations
     */
    async initialize() {
        try {
            await this.loadWatchlists();
            logger.info(`📋 Watchlist manager initialized with ${this.watchlists.size} watchlists`);
            
            // Set active watchlist to first enabled one
            const enabledWatchlists = Array.from(this.watchlists.entries())
                .filter(([name, config]) => config.enabled);
                
            if (enabledWatchlists.length > 0) {
                this.activeWatchlistName = enabledWatchlists[0][0];
                logger.info(`🎯 Active watchlist: ${this.activeWatchlistName}`);
            }
            
        } catch (error) {
            logger.error('❌ Failed to initialize watchlist manager:', error);
            this.createDefaultWatchlist();
        }
    }

    /**
     * Load watchlists from configuration file
     */
    async loadWatchlists() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            const watchlistsConfig = JSON.parse(data);
            
            for (const [name, config] of Object.entries(watchlistsConfig)) {
                this.watchlists.set(name, {
                    ...config,
                    symbols: this.validateSymbols(config.symbols || []),
                    lastUsed: null,
                    performance: {
                        totalReturn: 0,
                        winRate: 0,
                        avgVolatility: 0,
                        lastCalculated: null
                    }
                });
            }
            
            this.lastUpdate = Date.now();
            
        } catch (error) {
            throw new Error(`Failed to load watchlists: ${error.message}`);
        }
    }

    /**
     * Save watchlists to configuration file
     */
    async saveWatchlists() {
        try {
            const watchlistsConfig = {};
            
            for (const [name, config] of this.watchlists.entries()) {
                watchlistsConfig[name] = {
                    name: config.name,
                    description: config.description,
                    symbols: config.symbols,
                    enabled: config.enabled,
                    notes: config.notes || undefined
                };
            }
            
            await fs.writeFile(this.configPath, JSON.stringify(watchlistsConfig, null, 2));
            logger.info('💾 Watchlists saved successfully');
            
        } catch (error) {
            logger.error('❌ Failed to save watchlists:', error);
            throw error;
        }
    }

    /**
     * Get the active watchlist symbols
     */
    getActiveWatchlist() {
        const watchlist = this.watchlists.get(this.activeWatchlistName);
        if (!watchlist) {
            logger.warn(`⚠️ Active watchlist '${this.activeWatchlistName}' not found, using default`);
            return this.getDefaultSymbols();
        }
        
        watchlist.lastUsed = Date.now();
        return watchlist.symbols;
    }

    /**
     * Get watchlist by name
     */
    getWatchlist(name) {
        return this.watchlists.get(name);
    }

    /**
     * Get all available watchlists
     */
    getAllWatchlists() {
        const watchlists = {};
        for (const [name, config] of this.watchlists.entries()) {
            watchlists[name] = {
                name: config.name,
                description: config.description,
                symbolCount: config.symbols.length,
                enabled: config.enabled,
                lastUsed: config.lastUsed,
                performance: config.performance
            };
        }
        return watchlists;
    }

    /**
     * Set active watchlist
     */
    setActiveWatchlist(name) {
        if (!this.watchlists.has(name)) {
            throw new Error(`Watchlist '${name}' not found`);
        }
        
        const oldActive = this.activeWatchlistName;
        this.activeWatchlistName = name;
        
        // Enable the new active watchlist
        const watchlist = this.watchlists.get(name);
        watchlist.enabled = true;
        watchlist.lastUsed = Date.now();
        
        logger.info(`🔄 Switched from '${oldActive}' to '${name}' watchlist`);
        logger.info(`📊 New watchlist has ${watchlist.symbols.length} symbols: ${watchlist.symbols.slice(0, 5).join(', ')}${watchlist.symbols.length > 5 ? '...' : ''}`);
        
        return watchlist.symbols;
    }

    /**
     * Create a new watchlist
     */
    async createWatchlist(name, config) {
        if (this.watchlists.has(name)) {
            throw new Error(`Watchlist '${name}' already exists`);
        }

        const watchlistConfig = {
            name: config.name || name,
            description: config.description || `Custom watchlist: ${name}`,
            symbols: this.validateSymbols(config.symbols || []),
            enabled: config.enabled || false,
            notes: config.notes,
            lastUsed: null,
            performance: {
                totalReturn: 0,
                winRate: 0,
                avgVolatility: 0,
                lastCalculated: null
            }
        };

        this.watchlists.set(name, watchlistConfig);
        await this.saveWatchlists();
        
        logger.info(`✅ Created new watchlist '${name}' with ${watchlistConfig.symbols.length} symbols`);
        return watchlistConfig;
    }

    /**
     * Update existing watchlist
     */
    async updateWatchlist(name, updates) {
        const watchlist = this.watchlists.get(name);
        if (!watchlist) {
            throw new Error(`Watchlist '${name}' not found`);
        }

        // Update properties
        if (updates.name) watchlist.name = updates.name;
        if (updates.description) watchlist.description = updates.description;
        if (updates.symbols) watchlist.symbols = this.validateSymbols(updates.symbols);
        if (updates.enabled !== undefined) watchlist.enabled = updates.enabled;
        if (updates.notes) watchlist.notes = updates.notes;

        await this.saveWatchlists();
        logger.info(`🔧 Updated watchlist '${name}'`);
        
        return watchlist;
    }

    /**
     * Delete a watchlist
     */
    async deleteWatchlist(name) {
        if (name === 'default') {
            throw new Error('Cannot delete default watchlist');
        }
        
        if (!this.watchlists.has(name)) {
            throw new Error(`Watchlist '${name}' not found`);
        }

        this.watchlists.delete(name);
        
        // If deleted watchlist was active, switch to default
        if (this.activeWatchlistName === name) {
            this.activeWatchlistName = 'default';
            logger.info(`🔄 Switched to default watchlist after deleting '${name}'`);
        }

        await this.saveWatchlists();
        logger.info(`🗑️ Deleted watchlist '${name}'`);
    }

    /**
     * Add symbol to watchlist
     */
    async addSymbol(watchlistName, symbol) {
        const watchlist = this.watchlists.get(watchlistName);
        if (!watchlist) {
            throw new Error(`Watchlist '${watchlistName}' not found`);
        }

        const validatedSymbol = this.validateSymbol(symbol);
        if (!validatedSymbol) {
            throw new Error(`Invalid symbol: ${symbol}`);
        }

        if (!watchlist.symbols.includes(validatedSymbol)) {
            watchlist.symbols.push(validatedSymbol);
            await this.saveWatchlists();
            logger.info(`➕ Added ${validatedSymbol} to '${watchlistName}' watchlist`);
        } else {
            logger.warn(`⚠️ Symbol ${validatedSymbol} already exists in '${watchlistName}'`);
        }

        return watchlist.symbols;
    }

    /**
     * Remove symbol from watchlist
     */
    async removeSymbol(watchlistName, symbol) {
        const watchlist = this.watchlists.get(watchlistName);
        if (!watchlist) {
            throw new Error(`Watchlist '${watchlistName}' not found`);
        }

        const index = watchlist.symbols.indexOf(symbol.toUpperCase());
        if (index > -1) {
            watchlist.symbols.splice(index, 1);
            await this.saveWatchlists();
            logger.info(`➖ Removed ${symbol} from '${watchlistName}' watchlist`);
        } else {
            logger.warn(`⚠️ Symbol ${symbol} not found in '${watchlistName}'`);
        }

        return watchlist.symbols;
    }

    /**
     * Get symbols for specific strategy or use case
     */
    getSymbolsForStrategy(strategyName, maxSymbols = null) {
        let symbols = this.getActiveWatchlist();
        
        // Strategy-specific filtering
        switch (strategyName) {
            case 'momentum':
                // Prefer high-volume, volatile stocks for momentum
                symbols = this.filterByCharacteristics(symbols, 'momentum');
                break;
            case 'mean-reversion':
                // Prefer stable, less volatile stocks for mean reversion
                symbols = this.filterByCharacteristics(symbols, 'mean-reversion');
                break;
            case 'dividend':
                // Use dividend-focused watchlist if available
                if (this.watchlists.has('dividend_aristocrats')) {
                    symbols = this.watchlists.get('dividend_aristocrats').symbols;
                }
                break;
            case 'growth':
                // Use growth-focused watchlist if available
                if (this.watchlists.has('growth_stocks')) {
                    symbols = this.watchlists.get('growth_stocks').symbols;
                }
                break;
        }

        // Limit number of symbols if specified
        if (maxSymbols && symbols.length > maxSymbols) {
            symbols = symbols.slice(0, maxSymbols);
        }

        logger.info(`📊 Providing ${symbols.length} symbols for ${strategyName} strategy`);
        return symbols;
    }

    /**
     * Get performance-optimized watchlist
     */
    getTopPerformers(count = 10) {
        const symbols = this.getActiveWatchlist();
        
        // Sort by performance if available
        const symbolsWithPerf = symbols.map(symbol => ({
            symbol,
            performance: this.symbolPerformance.get(symbol) || { score: 0 }
        })).sort((a, b) => b.performance.score - a.performance.score);

        return symbolsWithPerf.slice(0, count).map(item => item.symbol);
    }

    /**
     * Update symbol performance data
     */
    updateSymbolPerformance(symbol, performanceData) {
        const existing = this.symbolPerformance.get(symbol) || {};
        
        this.symbolPerformance.set(symbol, {
            ...existing,
            ...performanceData,
            lastUpdate: Date.now()
        });
    }

    /**
     * Validate symbols format
     */
    validateSymbols(symbols) {
        return symbols
            .map(symbol => this.validateSymbol(symbol))
            .filter(symbol => symbol !== null);
    }

    /**
     * Validate individual symbol
     */
    validateSymbol(symbol) {
        if (typeof symbol !== 'string') return null;
        
        const cleaned = symbol.trim().toUpperCase();
        
        // Basic validation - 1-5 characters, letters and dots only
        if (!/^[A-Z]{1,5}(\.[A-Z])?$/.test(cleaned)) {
            logger.warn(`⚠️ Invalid symbol format: ${symbol}`);
            return null;
        }
        
        return cleaned;
    }

    /**
     * Filter symbols by characteristics (placeholder for future enhancement)
     */
    filterByCharacteristics(symbols, characteristic) {
        // This could be enhanced with actual market data
        // For now, just return the symbols as-is
        return symbols;
    }

    /**
     * Create default watchlist fallback
     */
    createDefaultWatchlist() {
        logger.warn('⚠️ Creating fallback default watchlist');
        
        this.watchlists.set('default', {
            name: 'Default Watchlist',
            description: 'Fallback watchlist',
            symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
            enabled: true,
            lastUsed: Date.now(),
            performance: {
                totalReturn: 0,
                winRate: 0,
                avgVolatility: 0,
                lastCalculated: null
            }
        });
        
        this.activeWatchlistName = 'default';
    }

    /**
     * Get default symbols fallback
     */
    getDefaultSymbols() {
        return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    }

    /**
     * Get watchlist statistics
     */
    getStatistics() {
        const stats = {
            totalWatchlists: this.watchlists.size,
            activeWatchlist: this.activeWatchlistName,
            totalSymbols: 0,
            enabledWatchlists: 0,
            lastUpdate: this.lastUpdate
        };

        for (const [name, config] of this.watchlists.entries()) {
            stats.totalSymbols += config.symbols.length;
            if (config.enabled) stats.enabledWatchlists++;
        }

        return stats;
    }
}
