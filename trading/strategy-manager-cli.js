/**
 * Strategy Manager CLI
 * 
 * Command-line interface for managing trading strategies
 * Allows attaching, detaching, and configuring strategies dynamically
 */

import dotenv from 'dotenv';
import { StrategyManager } from '../src/strategy-manager.js';
import { logger } from '../src/logger.js';

// Load environment variables
dotenv.config();

class StrategyManagerCLI {
    constructor() {
        this.strategyManager = new StrategyManager();
    }
    
    async initialize() {
        await this.strategyManager.initialize();
        console.log('🎯 Strategy Manager CLI initialized');
    }
    
    async listAvailable() {
        console.log('\n📋 Available Strategies:');
        console.log('=' .repeat(40));
        
        const available = this.strategyManager.getAvailableStrategies();
        if (available.length === 0) {
            console.log('No strategies available');
            return;
        }
        
        available.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });
    }
    
    async listActive() {
        console.log('\n🏃 Active Strategies:');
        console.log('=' .repeat(40));
        
        const active = this.strategyManager.getActiveStrategies();
        if (active.length === 0) {
            console.log('No active strategies');
            return;
        }
        
        for (const name of active) {
            const strategy = this.strategyManager.getStrategy(name);
            const metadata = strategy.getMetadata();
            const positions = strategy.getPositions().size;
            
            console.log(`📊 ${name}`);
            console.log(`   Version: ${metadata.version}`);
            console.log(`   Risk Level: ${metadata.riskLevel}`);
            console.log(`   Active Positions: ${positions}`);
            console.log(`   Description: ${metadata.description}`);
            console.log('');
        }
    }
    
    async attachStrategy(name, config = {}) {
        console.log(`\n🔗 Attaching strategy: ${name}`);
        
        const success = await this.strategyManager.attachStrategy(name, config);
        if (success) {
            console.log(`✅ Strategy '${name}' attached successfully`);
        } else {
            console.log(`❌ Failed to attach strategy '${name}'`);
        }
        
        return success;
    }
    
    async detachStrategy(name) {
        console.log(`\n🔌 Detaching strategy: ${name}`);
        
        const success = await this.strategyManager.detachStrategy(name);
        if (success) {
            console.log(`✅ Strategy '${name}' detached successfully`);
        } else {
            console.log(`❌ Failed to detach strategy '${name}'`);
        }
        
        return success;
    }
    
    async showPerformance() {
        console.log('\n📈 Strategy Performance:');
        console.log('=' .repeat(60));
        
        const metrics = this.strategyManager.getPerformanceMetrics();
        
        if (Object.keys(metrics).length === 0) {
            console.log('No performance data available');
            return;
        }
        
        for (const [name, data] of Object.entries(metrics)) {
            console.log(`📊 ${name.toUpperCase()}`);
            console.log(`   Total Signals: ${data.totalSignals || 0}`);
            console.log(`   Total Trades: ${data.totalTrades || 0}`);
            console.log(`   Active Positions: ${data.activePositions || 0}`);
            console.log(`   Strategy Type: ${data.strategyType || 'Unknown'}`);
            console.log('');
        }
    }
    
    async healthCheck() {
        console.log('\n🏥 Strategy Health Check:');
        console.log('=' .repeat(50));
        
        const health = await this.strategyManager.healthCheck();
        
        console.log(`Overall Status: ${this.getStatusEmoji(health.overall)} ${health.overall.toUpperCase()}`);
        console.log('');
        
        for (const [name, strategyHealth] of Object.entries(health.strategies)) {
            console.log(`${this.getStatusEmoji(strategyHealth.status)} ${name}`);
            console.log(`   Status: ${strategyHealth.status}`);
            
            if (strategyHealth.issues && strategyHealth.issues.length > 0) {
                console.log(`   Issues: ${strategyHealth.issues.join(', ')}`);
            }
            
            if (strategyHealth.historyCount !== undefined) {
                console.log(`   Price History: ${strategyHealth.historyCount} symbols`);
                console.log(`   Sufficient History: ${strategyHealth.sufficientHistoryCount} symbols`);
            }
            
            console.log('');
        }
    }
    
    getStatusEmoji(status) {
        switch (status) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            case 'unhealthy': return '🔴';
            default: return '❓';
        }
    }
    
    async saveConfiguration() {
        console.log('\n💾 Saving strategy configuration...');
        
        const success = await this.strategyManager.saveConfiguration();
        if (success) {
            console.log('✅ Configuration saved successfully');
        } else {
            console.log('❌ Failed to save configuration');
        }
    }
    
    printHelp() {
        console.log('\n🎯 Strategy Manager CLI Commands:');
        console.log('=' .repeat(50));
        console.log('list-available    - List all available strategies');
        console.log('list-active      - List currently active strategies');
        console.log('attach <name>    - Attach a strategy');
        console.log('detach <name>    - Detach a strategy');
        console.log('performance      - Show strategy performance metrics');
        console.log('health          - Run strategy health check');
        console.log('save            - Save current configuration');
        console.log('help            - Show this help message');
        console.log('exit            - Exit the CLI');
        console.log('');
    }
    
    async interactive() {
        console.log('🎯 Interactive Strategy Manager CLI');
        console.log('Type "help" for available commands');
        
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'strategy-manager> '
        });
        
        rl.prompt();
        
        rl.on('line', async (line) => {
            const [command, ...args] = line.trim().split(' ');
            
            try {
                switch (command) {
                    case 'list-available':
                        await this.listAvailable();
                        break;
                    
                    case 'list-active':
                        await this.listActive();
                        break;
                    
                    case 'attach':
                        if (args.length === 0) {
                            console.log('Usage: attach <strategy-name>');
                        } else {
                            await this.attachStrategy(args[0]);
                        }
                        break;
                    
                    case 'detach':
                        if (args.length === 0) {
                            console.log('Usage: detach <strategy-name>');
                        } else {
                            await this.detachStrategy(args[0]);
                        }
                        break;
                    
                    case 'performance':
                        await this.showPerformance();
                        break;
                    
                    case 'health':
                        await this.healthCheck();
                        break;
                    
                    case 'save':
                        await this.saveConfiguration();
                        break;
                    
                    case 'help':
                        this.printHelp();
                        break;
                    
                    case 'exit':
                        console.log('👋 Goodbye!');
                        rl.close();
                        return;
                    
                    default:
                        if (command) {
                            console.log(`Unknown command: ${command}`);
                            console.log('Type "help" for available commands');
                        }
                        break;
                }
            } catch (error) {
                console.error('❌ Error executing command:', error.message);
            }
            
            rl.prompt();
        });
        
        rl.on('close', () => {
            process.exit(0);
        });
    }
}

// Command-line argument handling
async function main() {
    const cli = new StrategyManagerCLI();
    
    try {
        await cli.initialize();
        
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            // Interactive mode
            await cli.interactive();
        } else {
            // Command mode
            const [command, ...params] = args;
            
            switch (command) {
                case 'list-available':
                    await cli.listAvailable();
                    break;
                
                case 'list-active':
                    await cli.listActive();
                    break;
                
                case 'attach':
                    if (params.length === 0) {
                        console.log('Usage: node strategy-manager-cli.js attach <strategy-name>');
                        process.exit(1);
                    }
                    await cli.attachStrategy(params[0]);
                    break;
                
                case 'detach':
                    if (params.length === 0) {
                        console.log('Usage: node strategy-manager-cli.js detach <strategy-name>');
                        process.exit(1);
                    }
                    await cli.detachStrategy(params[0]);
                    break;
                
                case 'performance':
                    await cli.showPerformance();
                    break;
                
                case 'health':
                    await cli.healthCheck();
                    break;
                
                case 'save':
                    await cli.saveConfiguration();
                    break;
                
                default:
                    console.log(`Unknown command: ${command}`);
                    console.log('Available commands: list-available, list-active, attach, detach, performance, health, save');
                    process.exit(1);
            }
        }
        
    } catch (error) {
        logger.error('CLI execution failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { StrategyManagerCLI };
