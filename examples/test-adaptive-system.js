/**
 * Test Adaptive System
 * 
 * Demonstrates the adaptive strategy selection system without actual trading.
 * Shows how the system analyzes market conditions and selects strategies.
 */

import { createMarketDataClient } from '../src/index.js';
import { StrategyManager } from '../src/strategy-manager.js';
import { AdaptiveStrategySelector } from '../src/adaptive-strategy-selector.js';
import { logger } from '../src/logger.js';

class AdaptiveSystemTest {
    constructor() {
        this.marketDataClient = null;
        this.strategyManager = null;
        this.adaptiveSelector = null;
    }

    async initialize() {
        console.log('🧠 Initializing Adaptive System Test...');
        
        // Create market data client
        this.marketDataClient = createMarketDataClient();
        
        // Test connection
        await this.marketDataClient.client.checkHealth();
        console.log('✅ Connected to IB Client Portal');
        
        // Initialize strategy manager (without loading config to avoid errors)
        this.strategyManager = new StrategyManager();
        
        // Mock some strategies for testing
        this.mockStrategies();
        
        // Initialize adaptive selector
        this.adaptiveSelector = new AdaptiveStrategySelector(
            this.marketDataClient,
            this.strategyManager
        );
        
        console.log('✅ Adaptive system initialized');
    }

    mockStrategies() {
        // Mock strategy manager methods for testing
        this.strategyManager.getAvailableStrategies = () => [
            'momentum', 'mean-reversion', 'wyckoff-v2', 'donchian-breakout',
            'elder-triple-screen', 'rsi2-mean-reversion', 'random-walk-passive'
        ];
        
        this.strategyManager.getActiveStrategies = () => ['momentum', 'mean-reversion'];
        
        this.strategyManager.attachStrategy = async (name, config) => {
            console.log(`✅ Mock: Attached strategy ${name} with config:`, config);
        };
        
        this.strategyManager.detachStrategy = async (name) => {
            console.log(`➖ Mock: Detached strategy ${name}`);
        };
    }

    async runTest() {
        console.log('\n' + '='.repeat(60));
        console.log('🧠 ADAPTIVE STRATEGY SELECTION TEST');
        console.log('='.repeat(60));

        try {
            // Run the adaptive selection process
            const result = await this.adaptiveSelector.selectOptimalStrategies();
            
            console.log('\n📊 MARKET ANALYSIS RESULTS:');
            console.log('─'.repeat(40));
            console.log(`Market Regime: ${result.marketAnalysis.regime}`);
            console.log(`Confidence: ${(result.marketAnalysis.confidence * 100).toFixed(1)}%`);
            
            console.log('\n📈 Market Indicators:');
            const indicators = result.marketAnalysis.indicators;
            console.log(`  Volatility: ${indicators.volatility.level} (${indicators.volatility.score.toFixed(2)})`);
            console.log(`  Trend: ${indicators.trend.direction} (strength: ${indicators.trend.strength.toFixed(2)})`);
            console.log(`  Momentum: ${indicators.momentum.type} (score: ${indicators.momentum.score.toFixed(2)})`);
            console.log(`  Breadth: ${indicators.breadth.type} (ratio: ${indicators.breadth.ratio.toFixed(2)})`);
            
            console.log('\n🎯 RECOMMENDED STRATEGIES:');
            console.log('─'.repeat(40));
            result.recommendedStrategies.forEach((strategy, index) => {
                console.log(`${index + 1}. ${strategy.name.toUpperCase()}`);
                console.log(`   Allocation: ${(strategy.allocation * 100).toFixed(1)}%`);
                console.log(`   Priority: ${strategy.priority}`);
                if (strategy.performanceScore !== undefined) {
                    console.log(`   Performance Score: ${strategy.performanceScore.toFixed(2)}`);
                }
                console.log('');
            });

            console.log(`🔄 Rebalancing: ${result.rebalanceExecuted ? 'EXECUTED' : 'NOT NEEDED'}`);
            
            // Show market data that was analyzed
            console.log('\n📊 MARKET DATA ANALYZED:');
            console.log('─'.repeat(40));
            const marketData = result.marketAnalysis.marketData;
            Object.entries(marketData).forEach(([symbol, data]) => {
                if (data && data.price) {
                    const changeColor = data.changePercent >= 0 ? '🟢' : '🔴';
                    console.log(`${changeColor} ${symbol}: $${data.price} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`);
                }
            });

            console.log('\n✅ Adaptive system test completed successfully!');
            return result;

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            throw error;
        }
    }

    async demonstrateAdaptation() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 DEMONSTRATING CONTINUOUS ADAPTATION');
        console.log('='.repeat(60));

        console.log('Running 3 adaptation cycles to show how the system responds...\n');

        for (let cycle = 1; cycle <= 3; cycle++) {
            console.log(`🔄 Adaptation Cycle ${cycle}:`);
            
            try {
                const result = await this.adaptiveSelector.selectOptimalStrategies();
                
                console.log(`   Market Regime: ${result.marketAnalysis.regime} (${(result.marketAnalysis.confidence * 100).toFixed(1)}%)`);
                console.log(`   Strategies: ${result.recommendedStrategies.map(s => s.name).join(', ')}`);
                console.log(`   Rebalanced: ${result.rebalanceExecuted ? 'Yes' : 'No'}`);
                
                // Simulate some performance updates
                this.simulatePerformanceUpdates();
                
            } catch (error) {
                console.log(`   ❌ Error in cycle ${cycle}:`, error.message);
            }
            
            console.log('');
            
            // Wait between cycles
            if (cycle < 3) {
                await this.sleep(3000);
            }
        }

        console.log('✅ Adaptation demonstration completed!');
    }

    simulatePerformanceUpdates() {
        // Simulate some trade results for performance tracking
        const strategies = ['momentum', 'mean-reversion', 'wyckoff-v2'];
        
        strategies.forEach(strategyName => {
            const mockTradeResult = {
                symbol: 'AAPL',
                pnl: (Math.random() - 0.3) * 50, // Slightly positive bias
                timestamp: Date.now()
            };
            
            this.adaptiveSelector.updateStrategyPerformance(strategyName, mockTradeResult);
        });
    }

    async showSystemStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 SYSTEM STATUS');
        console.log('='.repeat(60));

        const status = this.adaptiveSelector.getStatus();
        
        console.log(`Current Regime: ${status.currentRegime.regime} (${(status.currentRegime.confidence * 100).toFixed(1)}%)`);
        
        console.log('\nActive Strategies:');
        status.activeStrategies.forEach(strategy => {
            console.log(`  • ${strategy.name}: ${(strategy.allocation * 100).toFixed(1)}% allocation`);
            if (strategy.performance) {
                console.log(`    Win Rate: ${(strategy.performance.winRate * 100).toFixed(1)}%`);
                console.log(`    Total P&L: $${strategy.performance.totalPnL.toFixed(2)}`);
            }
        });

        if (status.adaptationHistory.length > 0) {
            console.log('\nRecent Adaptations:');
            status.adaptationHistory.slice(-3).forEach((adaptation, index) => {
                const date = new Date(adaptation.timestamp).toLocaleTimeString();
                console.log(`  ${index + 1}. ${date}: ${adaptation.marketRegime} → ${adaptation.strategies.length} strategies`);
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const test = new AdaptiveSystemTest();

    try {
        await test.initialize();
        
        // Run the main test
        await test.runTest();
        
        // Demonstrate adaptation over time
        await test.demonstrateAdaptation();
        
        // Show final system status
        await test.showSystemStatus();

        console.log('\n🎉 All tests completed successfully!');
        
        console.log('\n💡 To run the full adaptive bot:');
        console.log('   npm run adaptive-bot');

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { AdaptiveSystemTest };
