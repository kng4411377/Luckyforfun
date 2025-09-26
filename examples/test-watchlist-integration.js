/**
 * Watchlist Integration Example
 * 
 * Demonstrates how to integrate the watchlist manager with your trading systems,
 * market monitoring, and adaptive strategies.
 */

import { createMarketDataClient, WatchlistManager } from '../src/index.js';

class WatchlistIntegrationDemo {
    constructor() {
        this.watchlistManager = new WatchlistManager();
        this.marketDataClient = null;
    }

    async initialize() {
        console.log('📋 Initializing Watchlist Integration Demo...');
        
        // Initialize watchlist manager
        await this.watchlistManager.initialize();
        
        // Initialize market data client
        this.marketDataClient = createMarketDataClient();
        await this.marketDataClient.client.checkHealth();
        
        console.log('✅ Integration demo initialized');
    }

    async demonstrateBasicUsage() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BASIC WATCHLIST USAGE');
        console.log('='.repeat(60));

        // Get active watchlist
        const activeSymbols = this.watchlistManager.getActiveWatchlist();
        console.log(`Active Watchlist: ${this.watchlistManager.activeWatchlistName}`);
        console.log(`Symbols (${activeSymbols.length}): ${activeSymbols.join(', ')}`);

        // Show statistics
        const stats = this.watchlistManager.getStatistics();
        console.log('\n📊 Statistics:');
        console.log(`  Total Watchlists: ${stats.totalWatchlists}`);
        console.log(`  Total Symbols: ${stats.totalSymbols}`);
        console.log(`  Enabled Watchlists: ${stats.enabledWatchlists}`);
    }

    async demonstrateStrategySpecificWatchlists() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 STRATEGY-SPECIFIC WATCHLISTS');
        console.log('='.repeat(60));

        const strategies = [
            { name: 'momentum', maxSymbols: 5 },
            { name: 'mean-reversion', maxSymbols: 8 },
            { name: 'growth', maxSymbols: 6 },
            { name: 'dividend', maxSymbols: 10 }
        ];

        for (const strategy of strategies) {
            const symbols = this.watchlistManager.getSymbolsForStrategy(
                strategy.name, 
                strategy.maxSymbols
            );
            
            console.log(`${strategy.name.toUpperCase()} Strategy:`);
            console.log(`  Symbols (${symbols.length}): ${symbols.join(', ')}`);
        }
    }

    async demonstrateMarketDataIntegration() {
        console.log('\n' + '='.repeat(60));
        console.log('📈 MARKET DATA INTEGRATION');
        console.log('='.repeat(60));

        // Get symbols from momentum strategy watchlist
        const symbols = this.watchlistManager.getSymbolsForStrategy('momentum', 3);
        console.log(`Getting market data for: ${symbols.join(', ')}`);

        for (const symbol of symbols) {
            try {
                const quote = await this.marketDataClient.getQuote(symbol);
                if (quote && quote.length > 0) {
                    const data = quote[0];
                    const price = data.last || data.bid || data.ask;
                    const change = data.changePercent || 0;
                    const changeColor = change >= 0 ? '🟢' : '🔴';
                    
                    console.log(`  ${changeColor} ${symbol}: $${price} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
                    
                    // Update symbol performance (demo)
                    this.watchlistManager.updateSymbolPerformance(symbol, {
                        price: price,
                        change: change,
                        score: Math.abs(change) * 10 // Simple scoring
                    });
                }
            } catch (error) {
                console.log(`  ❌ ${symbol}: Error getting data`);
            }
            
            // Rate limiting
            await this.sleep(1000);
        }
    }

    async demonstratePerformanceOptimization() {
        console.log('\n' + '='.repeat(60));
        console.log('🏆 PERFORMANCE OPTIMIZATION');
        console.log('='.repeat(60));

        // Get top performers
        const topPerformers = this.watchlistManager.getTopPerformers(5);
        console.log(`Top Performing Symbols: ${topPerformers.join(', ')}`);

        // Show performance data
        console.log('\nPerformance Details:');
        topPerformers.forEach((symbol, index) => {
            console.log(`  ${index + 1}. ${symbol} - Score: ${this.getPerformanceScore(symbol)}`);
        });
    }

    async demonstrateDynamicWatchlistSwitching() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 DYNAMIC WATCHLIST SWITCHING');
        console.log('='.repeat(60));

        // Simulate market condition changes
        const marketConditions = [
            { condition: 'BULL_MARKET', watchlist: 'growth_stocks' },
            { condition: 'BEAR_MARKET', watchlist: 'dividend_aristocrats' },
            { condition: 'VOLATILE_MARKET', watchlist: 'momentum_plays' },
            { condition: 'TECH_RALLY', watchlist: 'tech_focused' }
        ];

        console.log('Simulating market condition changes:');
        
        for (const scenario of marketConditions) {
            console.log(`\n📊 Market Condition: ${scenario.condition}`);
            
            try {
                const symbols = this.watchlistManager.setActiveWatchlist(scenario.watchlist);
                console.log(`  ✅ Switched to: ${scenario.watchlist}`);
                console.log(`  📊 Symbols (${symbols.length}): ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''}`);
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
            
            await this.sleep(1000);
        }
    }

    async demonstrateCustomWatchlistCreation() {
        console.log('\n' + '='.repeat(60));
        console.log('🛠️ CUSTOM WATCHLIST CREATION');
        console.log('='.repeat(60));

        try {
            // Create a new watchlist
            const aiStocks = [
                'NVDA', 'AMD', 'GOOGL', 'MSFT', 'TSLA',
                'PLTR', 'C3AI', 'AI', 'SMCI', 'ARM'
            ];

            const watchlist = await this.watchlistManager.createWatchlist('ai_revolution', {
                name: 'AI Revolution',
                description: 'Companies leading the AI revolution',
                symbols: aiStocks,
                enabled: true,
                notes: 'Focus on artificial intelligence and machine learning companies'
            });

            console.log(`✅ Created watchlist: ${watchlist.name}`);
            console.log(`📊 Description: ${watchlist.description}`);
            console.log(`📊 Symbols (${watchlist.symbols.length}): ${watchlist.symbols.join(', ')}`);
            
            // Switch to the new watchlist
            this.watchlistManager.setActiveWatchlist('ai_revolution');
            console.log(`🔄 Switched to new watchlist`);

        } catch (error) {
            console.log(`❌ Error creating watchlist: ${error.message}`);
        }
    }

    async demonstrateConfigurationManagement() {
        console.log('\n' + '='.repeat(60));
        console.log('⚙️ CONFIGURATION MANAGEMENT');
        console.log('='.repeat(60));

        console.log('💾 Saving watchlist configuration...');
        try {
            await this.watchlistManager.saveWatchlists();
            console.log('✅ Configuration saved successfully');
            
            // Show file location
            console.log(`📁 Configuration file: config/watchlists.json`);
            console.log(`📝 You can edit this file directly to customize watchlists`);
            
        } catch (error) {
            console.log(`❌ Error saving: ${error.message}`);
        }
    }

    getPerformanceScore(symbol) {
        // Mock performance score for demo
        return (Math.random() * 100).toFixed(1);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showUsageTips() {
        console.log('\n' + '='.repeat(60));
        console.log('💡 USAGE TIPS');
        console.log('='.repeat(60));
        
        console.log('🔧 CLI Commands:');
        console.log('  npm run watchlist list              - Show all watchlists');
        console.log('  npm run watchlist show default     - Show watchlist details');
        console.log('  npm run watchlist switch tech_focused - Switch active watchlist');
        console.log('  npm run watchlist add custom NVDA  - Add symbol to watchlist');
        console.log('  npm run watchlist create my_picks "My favorite stocks"');
        
        console.log('\n📝 Configuration:');
        console.log('  Edit config/watchlists.json to customize watchlists');
        console.log('  Each watchlist has: name, description, symbols, enabled status');
        
        console.log('\n🔗 Integration:');
        console.log('  Use WatchlistManager in your trading strategies');
        console.log('  Get strategy-specific symbols with getSymbolsForStrategy()');
        console.log('  Track performance with updateSymbolPerformance()');
        console.log('  Switch watchlists based on market conditions');
    }
}

// Main execution
async function main() {
    const demo = new WatchlistIntegrationDemo();

    try {
        await demo.initialize();
        
        await demo.demonstrateBasicUsage();
        await demo.demonstrateStrategySpecificWatchlists();
        await demo.demonstrateMarketDataIntegration();
        await demo.demonstratePerformanceOptimization();
        await demo.demonstrateDynamicWatchlistSwitching();
        await demo.demonstrateCustomWatchlistCreation();
        await demo.demonstrateConfigurationManagement();
        
        demo.showUsageTips();

        console.log('\n🎉 Watchlist integration demo completed!');

    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { WatchlistIntegrationDemo };
