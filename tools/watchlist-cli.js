#!/usr/bin/env node
/**
 * Watchlist CLI Tool
 * 
 * Command-line interface for managing trading watchlists.
 * 
 * Usage:
 *   node tools/watchlist-cli.js list
 *   node tools/watchlist-cli.js show default
 *   node tools/watchlist-cli.js switch tech_focused
 *   node tools/watchlist-cli.js add custom TSLA
 *   node tools/watchlist-cli.js remove custom TSLA
 *   node tools/watchlist-cli.js create my_picks "My favorite stocks"
 */

import { WatchlistManager } from '../src/watchlist-manager.js';

class WatchlistCLI {
    constructor() {
        this.watchlistManager = new WatchlistManager();
    }

    async initialize() {
        await this.watchlistManager.initialize();
    }

    async listWatchlists() {
        console.log('📋 Available Watchlists:');
        console.log('='.repeat(50));
        
        const watchlists = this.watchlistManager.getAllWatchlists();
        const activeWatchlist = this.watchlistManager.activeWatchlistName;
        
        for (const [name, config] of Object.entries(watchlists)) {
            const isActive = name === activeWatchlist;
            const status = config.enabled ? '✅' : '⭕';
            const activeMarker = isActive ? ' 👈 ACTIVE' : '';
            
            console.log(`${status} ${name}${activeMarker}`);
            console.log(`   ${config.description}`);
            console.log(`   Symbols: ${config.symbolCount}`);
            if (config.lastUsed) {
                console.log(`   Last used: ${new Date(config.lastUsed).toLocaleString()}`);
            }
            console.log('');
        }
    }

    async showWatchlist(name) {
        const watchlist = this.watchlistManager.getWatchlist(name);
        if (!watchlist) {
            console.error(`❌ Watchlist '${name}' not found`);
            return;
        }

        console.log(`📊 Watchlist: ${watchlist.name}`);
        console.log('='.repeat(50));
        console.log(`Description: ${watchlist.description}`);
        console.log(`Status: ${watchlist.enabled ? 'Enabled ✅' : 'Disabled ⭕'}`);
        console.log(`Symbols (${watchlist.symbols.length}):`);
        
        // Display symbols in rows of 5
        for (let i = 0; i < watchlist.symbols.length; i += 5) {
            const row = watchlist.symbols.slice(i, i + 5);
            console.log(`  ${row.join(', ')}`);
        }
        
        if (watchlist.notes) {
            console.log(`\nNotes: ${watchlist.notes}`);
        }
    }

    async switchWatchlist(name) {
        try {
            const symbols = this.watchlistManager.setActiveWatchlist(name);
            console.log(`✅ Switched to '${name}' watchlist`);
            console.log(`📊 Active symbols (${symbols.length}): ${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? '...' : ''}`);
        } catch (error) {
            console.error(`❌ ${error.message}`);
        }
    }

    async addSymbol(watchlistName, symbol) {
        try {
            const symbols = await this.watchlistManager.addSymbol(watchlistName, symbol);
            console.log(`✅ Added ${symbol.toUpperCase()} to '${watchlistName}'`);
            console.log(`📊 Watchlist now has ${symbols.length} symbols`);
        } catch (error) {
            console.error(`❌ ${error.message}`);
        }
    }

    async removeSymbol(watchlistName, symbol) {
        try {
            const symbols = await this.watchlistManager.removeSymbol(watchlistName, symbol);
            console.log(`✅ Removed ${symbol.toUpperCase()} from '${watchlistName}'`);
            console.log(`📊 Watchlist now has ${symbols.length} symbols`);
        } catch (error) {
            console.error(`❌ ${error.message}`);
        }
    }

    async createWatchlist(name, description, symbols = []) {
        try {
            const watchlist = await this.watchlistManager.createWatchlist(name, {
                name: name.charAt(0).toUpperCase() + name.slice(1),
                description: description || `Custom watchlist: ${name}`,
                symbols: symbols,
                enabled: false
            });
            
            console.log(`✅ Created watchlist '${name}'`);
            console.log(`📊 Description: ${watchlist.description}`);
            console.log(`📊 Symbols: ${watchlist.symbols.length}`);
        } catch (error) {
            console.error(`❌ ${error.message}`);
        }
    }

    async deleteWatchlist(name) {
        try {
            await this.watchlistManager.deleteWatchlist(name);
            console.log(`✅ Deleted watchlist '${name}'`);
        } catch (error) {
            console.error(`❌ ${error.message}`);
        }
    }

    async showStatistics() {
        const stats = this.watchlistManager.getStatistics();
        
        console.log('📊 Watchlist Statistics:');
        console.log('='.repeat(30));
        console.log(`Total Watchlists: ${stats.totalWatchlists}`);
        console.log(`Enabled Watchlists: ${stats.enabledWatchlists}`);
        console.log(`Active Watchlist: ${stats.activeWatchlist}`);
        console.log(`Total Symbols: ${stats.totalSymbols}`);
        
        if (stats.lastUpdate) {
            console.log(`Last Update: ${new Date(stats.lastUpdate).toLocaleString()}`);
        }
    }

    showHelp() {
        console.log('📋 Watchlist CLI - Help');
        console.log('='.repeat(30));
        console.log('');
        console.log('Commands:');
        console.log('  list                    - List all watchlists');
        console.log('  show <name>             - Show watchlist details');
        console.log('  switch <name>           - Switch active watchlist');
        console.log('  add <watchlist> <symbol> - Add symbol to watchlist');
        console.log('  remove <watchlist> <symbol> - Remove symbol from watchlist');
        console.log('  create <name> [description] - Create new watchlist');
        console.log('  delete <name>           - Delete watchlist');
        console.log('  stats                   - Show statistics');
        console.log('  help                    - Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  node tools/watchlist-cli.js list');
        console.log('  node tools/watchlist-cli.js show default');
        console.log('  node tools/watchlist-cli.js switch tech_focused');
        console.log('  node tools/watchlist-cli.js add custom NVDA');
        console.log('  node tools/watchlist-cli.js create my_ai "AI and ML stocks"');
    }
}

// Main execution
async function main() {
    const cli = new WatchlistCLI();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        cli.showHelp();
        return;
    }

    try {
        await cli.initialize();
        
        const command = args[0];
        
        switch (command) {
            case 'list':
                await cli.listWatchlists();
                break;
                
            case 'show':
                if (args.length < 2) {
                    console.error('❌ Usage: show <watchlist-name>');
                    return;
                }
                await cli.showWatchlist(args[1]);
                break;
                
            case 'switch':
                if (args.length < 2) {
                    console.error('❌ Usage: switch <watchlist-name>');
                    return;
                }
                await cli.switchWatchlist(args[1]);
                break;
                
            case 'add':
                if (args.length < 3) {
                    console.error('❌ Usage: add <watchlist-name> <symbol>');
                    return;
                }
                await cli.addSymbol(args[1], args[2]);
                break;
                
            case 'remove':
                if (args.length < 3) {
                    console.error('❌ Usage: remove <watchlist-name> <symbol>');
                    return;
                }
                await cli.removeSymbol(args[1], args[2]);
                break;
                
            case 'create':
                if (args.length < 2) {
                    console.error('❌ Usage: create <name> [description]');
                    return;
                }
                await cli.createWatchlist(args[1], args[2]);
                break;
                
            case 'delete':
                if (args.length < 2) {
                    console.error('❌ Usage: delete <watchlist-name>');
                    return;
                }
                await cli.deleteWatchlist(args[1]);
                break;
                
            case 'stats':
                await cli.showStatistics();
                break;
                
            case 'help':
            default:
                cli.showHelp();
                break;
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { WatchlistCLI };
