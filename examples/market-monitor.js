/**
 * Continuous Market Monitor
 * 
 * This script continuously monitors your account and market data
 * without executing any trades. Perfect for passive monitoring.
 */

import { createClient, createMarketDataClient } from '../src/index.js';
import { logger } from '../src/logger.js';

class MarketMonitor {
    constructor() {
        this.client = createClient();
        this.marketDataClient = createMarketDataClient();
        this.isRunning = false;
        this.monitorInterval = null;
        this.watchlist = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
    }

    async initialize() {
        console.log('📊 Initializing Market Monitor...');
        
        // Test connection
        await this.client.checkHealth();
        console.log('✅ Connected to IB Client Portal');
        
        // Check authentication
        const authStatus = await this.client.getAuthStatus();
        if (!authStatus.authenticated) {
            throw new Error('❌ Not authenticated with IB Client Portal');
        }
        console.log('✅ Authenticated successfully');
        
        // Get account info
        const accounts = await this.client.getAccounts();
        this.accountId = accounts[0]?.id || accounts[0]?.accountId;
        console.log(`✅ Monitoring account: ${this.accountId}`);
        
        console.log('🚀 Market Monitor initialized successfully!');
    }

    async monitorAccount() {
        try {
            console.log('\n' + '='.repeat(60));
            console.log(`📊 Account Monitor - ${new Date().toLocaleTimeString()}`);
            console.log('='.repeat(60));
            
            // Get account summary
            const summary = await this.client.getAccountSummary(this.accountId);
            
            console.log('💰 Account Summary:');
            console.log(`   Net Liquidation: $${this.formatMoney(summary.netliquidation?.amount)}`);
            console.log(`   Available Funds: $${this.formatMoney(summary.availablefunds?.amount)}`);
            console.log(`   Buying Power: $${this.formatMoney(summary.buyingpower?.amount)}`);
            console.log(`   Total Cash: $${this.formatMoney(summary.totalcashvalue?.amount)}`);
            console.log(`   Unrealized P&L: $${this.formatMoney(summary.unrealizedpnl?.amount) || 'N/A'}`);
            
            // Get positions
            const positions = await this.client.getPositions(this.accountId);
            if (positions && positions.length > 0) {
                console.log(`\n📈 Current Positions (${positions.length}):`);
                positions.slice(0, 5).forEach(pos => {
                    const symbol = pos.contractDesc?.split(' ')[0] || 'Unknown';
                    const unrealizedPnL = pos.unrealizedPnl || 0;
                    const pnlColor = unrealizedPnL >= 0 ? '🟢' : '🔴';
                    console.log(`   ${pnlColor} ${symbol}: ${pos.position} shares, P&L: $${this.formatMoney(unrealizedPnL)}`);
                });
                if (positions.length > 5) {
                    console.log(`   ... and ${positions.length - 5} more positions`);
                }
            } else {
                console.log('\n📈 No current positions');
            }
            
        } catch (error) {
            console.error('❌ Error monitoring account:', error.message);
        }
    }

    async monitorWatchlist() {
        try {
            console.log('\n📊 Watchlist Monitor:');
            
            for (const symbol of this.watchlist.slice(0, 3)) { // Limit to avoid rate limiting
                try {
                    const quote = await this.marketDataClient.getQuote(symbol);
                    if (quote && quote.length > 0) {
                        const data = quote[0];
                        const price = data.last || data.bid || data.ask || 'N/A';
                        const change = data.change || 0;
                        const changePercent = data.changePercent || 0;
                        const changeColor = change >= 0 ? '🟢' : '🔴';
                        
                        console.log(`   ${changeColor} ${symbol}: $${price} (${change >= 0 ? '+' : ''}${this.formatMoney(change)}, ${changePercent.toFixed(2)}%)`);
                    }
                } catch (error) {
                    console.log(`   ⚪ ${symbol}: Data unavailable`);
                }
                
                // Rate limiting
                await this.sleep(1000);
            }
            
        } catch (error) {
            console.error('❌ Error monitoring watchlist:', error.message);
        }
    }

    formatMoney(amount) {
        if (amount === undefined || amount === null) return 'N/A';
        return parseFloat(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    start(intervalMinutes = 1) {
        if (this.isRunning) {
            console.log('⚠️ Monitor is already running');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Starting continuous monitoring (every ${intervalMinutes} minute${intervalMinutes > 1 ? 's' : ''})`);
        console.log('Press Ctrl+C to stop');

        // Run immediately
        this.runMonitorCycle();

        // Schedule regular monitoring
        this.monitorInterval = setInterval(() => {
            this.runMonitorCycle();
        }, intervalMinutes * 60 * 1000);
    }

    async runMonitorCycle() {
        await this.monitorAccount();
        await this.sleep(2000); // Wait between calls
        await this.monitorWatchlist();
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isRunning = false;
        console.log('\n🛑 Market monitor stopped');
    }
}

// Main execution
async function main() {
    const monitor = new MarketMonitor();

    try {
        await monitor.initialize();
        
        // Start monitoring every 2 minutes (adjust as needed)
        monitor.start(2);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down market monitor...');
            monitor.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start market monitor:', error.message);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { MarketMonitor };
