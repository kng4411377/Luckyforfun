/**
 * REST API Server for Trading Strategy Management
 * 
 * Provides endpoints for:
 * 1. Strategy configuration management
 * 2. Account holdings retrieval
 * 3. IBKR integration
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { IBClient } from './client.js';
import { Config } from './config.js';
import { AuthenticationError, IBSDKError } from './exceptions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TradingAPIServer {
    constructor(options = {}) {
        this.port = options.port || process.env.API_PORT || 3000;
        this.host = options.host || process.env.API_HOST || 'localhost';
        this.strategiesConfigPath = options.strategiesConfigPath || 
            path.join(__dirname, '../config/strategies.json');
        
        // IBKR Client configuration
        this.ibkrConfig = new Config({
            host: options.ibkrHost || process.env.IB_HOST || '127.0.0.1',
            port: options.ibkrPort || parseInt(process.env.IB_PORT) || 5000,
            useHttps: options.ibkrUseHttps !== undefined ? options.ibkrUseHttps : false, // Default to HTTP
            verifySsl: options.ibkrVerifySsl || false,
            rateLimit: options.ibkrRateLimit || 1.0
        });
        
        this.ibClient = null;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
        
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('API Error:', err);
            
            if (err instanceof AuthenticationError) {
                return res.status(401).json({ 
                    error: 'Authentication required', 
                    message: err.message 
                });
            }
            
            if (err instanceof IBSDKError) {
                return res.status(400).json({ 
                    error: 'IBKR API Error', 
                    message: err.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Internal Server Error', 
                message: err.message 
            });
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                ibkrConfig: {
                    host: this.ibkrConfig.host,
                    port: this.ibkrConfig.port,
                    protocol: this.ibkrConfig.useHttps ? 'https' : 'http'
                }
            });
        });
        
        // Strategy configuration endpoints
        this.app.get('/api/strategies', this.getStrategies.bind(this));
        this.app.get('/api/strategies/:name', this.getStrategy.bind(this));
        this.app.put('/api/strategies/:name', this.updateStrategy.bind(this));
        this.app.post('/api/strategies/:name/enable', this.enableStrategy.bind(this));
        this.app.post('/api/strategies/:name/disable', this.disableStrategy.bind(this));
        
        // Account and holdings endpoints
        this.app.get('/api/account/status', this.getAccountStatus.bind(this));
        this.app.get('/api/account/holdings', this.getAccountHoldings.bind(this));
        this.app.get('/api/account/summary', this.getAccountSummary.bind(this));
        
        // IBKR connection management
        this.app.post('/api/ibkr/connect', this.connectIBKR.bind(this));
        this.app.get('/api/ibkr/status', this.getIBKRStatus.bind(this));
    }
    
    async loadStrategiesConfig() {
        try {
            const data = await fs.readFile(this.strategiesConfigPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Failed to load strategies config: ${error.message}`);
        }
    }
    
    async saveStrategiesConfig(config) {
        try {
            await fs.writeFile(
                this.strategiesConfigPath, 
                JSON.stringify(config, null, 2), 
                'utf8'
            );
        } catch (error) {
            throw new Error(`Failed to save strategies config: ${error.message}`);
        }
    }
    
    // Strategy Management Endpoints
    
    async getStrategies(req, res, next) {
        try {
            const config = await this.loadStrategiesConfig();
            res.json({
                enabled: config.enabled || [],
                available: config.available || [],
                global: config.global || {}
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getStrategy(req, res, next) {
        try {
            const { name } = req.params;
            const config = await this.loadStrategiesConfig();
            
            // Look in enabled strategies first
            let strategy = config.enabled?.find(s => s.name === name);
            if (!strategy) {
                // Look in available strategies
                strategy = config.available?.find(s => s.name === name);
            }
            
            if (!strategy) {
                return res.status(404).json({ 
                    error: 'Strategy not found', 
                    message: `Strategy '${name}' does not exist` 
                });
            }
            
            res.json(strategy);
        } catch (error) {
            next(error);
        }
    }
    
    async updateStrategy(req, res, next) {
        try {
            const { name } = req.params;
            const updatedConfig = req.body;
            
            if (!updatedConfig.config) {
                return res.status(400).json({ 
                    error: 'Invalid request', 
                    message: 'Strategy config is required' 
                });
            }
            
            const config = await this.loadStrategiesConfig();
            let updated = false;
            
            // Update in enabled strategies
            if (config.enabled) {
                const index = config.enabled.findIndex(s => s.name === name);
                if (index !== -1) {
                    config.enabled[index] = { name, config: updatedConfig.config };
                    updated = true;
                }
            }
            
            // Update in available strategies
            if (config.available && !updated) {
                const index = config.available.findIndex(s => s.name === name);
                if (index !== -1) {
                    config.available[index] = { name, config: updatedConfig.config };
                    updated = true;
                }
            }
            
            if (!updated) {
                return res.status(404).json({ 
                    error: 'Strategy not found', 
                    message: `Strategy '${name}' does not exist` 
                });
            }
            
            await this.saveStrategiesConfig(config);
            res.json({ 
                success: true, 
                message: `Strategy '${name}' updated successfully`,
                strategy: { name, config: updatedConfig.config }
            });
        } catch (error) {
            next(error);
        }
    }
    
    async enableStrategy(req, res, next) {
        try {
            const { name } = req.params;
            const config = await this.loadStrategiesConfig();
            
            // Find strategy in available list
            const availableIndex = config.available?.findIndex(s => s.name === name);
            if (availableIndex === -1) {
                return res.status(404).json({ 
                    error: 'Strategy not found', 
                    message: `Strategy '${name}' not found in available strategies` 
                });
            }
            
            // Check if already enabled
            const alreadyEnabled = config.enabled?.some(s => s.name === name);
            if (alreadyEnabled) {
                return res.status(400).json({ 
                    error: 'Strategy already enabled', 
                    message: `Strategy '${name}' is already enabled` 
                });
            }
            
            // Move from available to enabled
            const strategy = config.available[availableIndex];
            strategy.config.enabled = true;
            
            config.enabled = config.enabled || [];
            config.enabled.push(strategy);
            config.available.splice(availableIndex, 1);
            
            await this.saveStrategiesConfig(config);
            res.json({ 
                success: true, 
                message: `Strategy '${name}' enabled successfully`,
                strategy
            });
        } catch (error) {
            next(error);
        }
    }
    
    async disableStrategy(req, res, next) {
        try {
            const { name } = req.params;
            const config = await this.loadStrategiesConfig();
            
            // Find strategy in enabled list
            const enabledIndex = config.enabled?.findIndex(s => s.name === name);
            if (enabledIndex === -1) {
                return res.status(404).json({ 
                    error: 'Strategy not found', 
                    message: `Strategy '${name}' not found in enabled strategies` 
                });
            }
            
            // Move from enabled to available
            const strategy = config.enabled[enabledIndex];
            strategy.config.enabled = false;
            
            config.available = config.available || [];
            config.available.push(strategy);
            config.enabled.splice(enabledIndex, 1);
            
            await this.saveStrategiesConfig(config);
            res.json({ 
                success: true, 
                message: `Strategy '${name}' disabled successfully`,
                strategy
            });
        } catch (error) {
            next(error);
        }
    }
    
    // IBKR Integration Endpoints
    
    async ensureIBKRClient() {
        if (!this.ibClient) {
            this.ibClient = new IBClient(this.ibkrConfig);
        }
        return this.ibClient;
    }
    
    async connectIBKR(req, res, next) {
        try {
            const client = await this.ensureIBKRClient();
            
            // Test connection
            const health = await client.checkHealth();
            
            // Get auth status
            const authStatus = await client.getAuthStatus();
            
            if (!authStatus.authenticated) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'Please log in to IB Gateway first',
                    health,
                    authStatus
                });
            }
            
            // Get accounts
            const accounts = await client.getAccounts();
            
            res.json({
                success: true,
                message: 'Successfully connected to IBKR',
                config: this.ibkrConfig.toString(),
                health,
                authStatus,
                accounts
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getIBKRStatus(req, res, next) {
        try {
            const client = await this.ensureIBKRClient();
            
            const health = await client.checkHealth();
            const authStatus = await client.getAuthStatus();
            
            res.json({
                config: this.ibkrConfig.toString(),
                health,
                authStatus,
                connected: authStatus.authenticated || false
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getAccountStatus(req, res, next) {
        try {
            const client = await this.ensureIBKRClient();
            
            const authStatus = await client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new AuthenticationError('Not authenticated with IBKR');
            }
            
            const accounts = await client.getAccounts();
            
            res.json({
                authenticated: true,
                accounts,
                primaryAccount: client.accountId
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getAccountHoldings(req, res, next) {
        try {
            const client = await this.ensureIBKRClient();
            
            const authStatus = await client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new AuthenticationError('Not authenticated with IBKR');
            }
            
            const { accountId } = req.query;
            const positions = await client.getPositions(accountId);
            
            res.json({
                accountId: accountId || client.accountId,
                positions,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getAccountSummary(req, res, next) {
        try {
            const client = await this.ensureIBKRClient();
            
            const authStatus = await client.getAuthStatus();
            if (!authStatus.authenticated) {
                throw new AuthenticationError('Not authenticated with IBKR');
            }
            
            const { accountId } = req.query;
            const summary = await client.getAccountSummary(accountId);
            
            res.json({
                accountId: accountId || client.accountId,
                summary,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            next(error);
        }
    }
    
    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, this.host, () => {
                console.log(`🚀 Trading API Server running on http://${this.host}:${this.port}`);
                console.log(`📊 Strategy config: ${this.strategiesConfigPath}`);
                console.log(`🔌 IBKR config: ${this.ibkrConfig.toString()}`);
                resolve();
            });
        });
    }
    
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
    }
}

// Factory function for easy usage
export function createTradingAPIServer(options = {}) {
    return new TradingAPIServer(options);
}
