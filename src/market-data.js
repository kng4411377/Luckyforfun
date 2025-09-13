/**
 * Market data client for stock price querying and market data retrieval
 */

import { IBClient } from './client.js';
import { Config } from './config.js';
import { IBSDKError, InvalidSymbolError, AuthenticationError } from './exceptions.js';

export class MarketDataClient {
    /**
     * Client for retrieving market data from Interactive Brokers
     * 
     * This client provides methods for querying stock prices, market data snapshots,
     * and instrument information with proper rate limiting.
     * 
     * @param {IBClient} [ibClient] - Existing IBClient instance. If null, creates a new one.
     * @param {Config} [config] - Configuration object. If null, uses default config.
     */
    constructor(ibClient = null, config = null) {
        this.client = ibClient || new IBClient(config);
        this.config = config || new Config();
        
        // Cache for contract IDs to avoid repeated lookups
        this._contractCache = new Map();
    }
    
    /**
     * Search for a stock symbol and get contract information
     * 
     * @param {string} symbol - Stock symbol to search for (e.g., "AAPL", "MSFT")
     * @returns {Promise<Array>} List of matching contracts with their details
     * @throws {InvalidSymbolError} If no contracts found for the symbol
     */
    async searchSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            throw new InvalidSymbolError('Symbol must be a non-empty string');
        }
        
        // Clean up symbol
        symbol = symbol.toUpperCase().trim();
        
        try {
            const response = await this.client._makeRequest(
                'GET',
                'portal/iserver/secdef/search',
                { symbol }
            );
            
            if (!response || response.length === 0) {
                throw new InvalidSymbolError(`No contracts found for symbol: ${symbol}`);
            }
            
            // Cache the first contract for this symbol
            if (response && response.length > 0) {
                // Look for stock contracts (secType = "STK")
                const stockContracts = response.filter(c => c.secType === 'STK');
                if (stockContracts.length > 0) {
                    this._contractCache.set(symbol, stockContracts[0].conid);
                } else if (response.length > 0) {
                    // Fallback to first contract if no stock found
                    this._contractCache.set(symbol, response[0].conid);
                }
            }
            
            return response;
            
        } catch (error) {
            if (error instanceof IBSDKError || error instanceof InvalidSymbolError) {
                throw error;
            }
            throw new IBSDKError(`Failed to search symbol ${symbol}: ${error.message}`);
        }
    }
    
    /**
     * Get contract ID for a stock symbol
     * 
     * @param {string} symbol - Stock symbol
     * @returns {Promise<number>} Contract ID (conid) for the symbol
     * @throws {InvalidSymbolError} If symbol not found
     */
    async getContractId(symbol) {
        symbol = symbol.toUpperCase().trim();
        
        // Check cache first
        if (this._contractCache.has(symbol)) {
            return this._contractCache.get(symbol);
        }
        
        // Search for the symbol
        const contracts = await this.searchSymbol(symbol);
        
        // Find stock contract
        for (const contract of contracts) {
            if (contract.secType === 'STK') {
                const conid = contract.conid;
                if (conid) {
                    this._contractCache.set(symbol, conid);
                    return conid;
                }
            }
        }
        
        // Fallback to first contract
        if (contracts && contracts.length > 0 && contracts[0].conid) {
            const conid = contracts[0].conid;
            this._contractCache.set(symbol, conid);
            return conid;
        }
        
        throw new InvalidSymbolError(`No valid contract ID found for symbol: ${symbol}`);
    }
    
    /**
     * Get market data snapshot for one or more symbols
     * 
     * @param {string|Array<string>} symbols - Single symbol or array of symbols
     * @param {Array<string>} [fields] - List of fields to retrieve. If null, gets common fields.
     *                                   Common fields: "31" (bid), "84" (ask), "86" (last), "87" (volume)
     * @returns {Promise<Object>} Dictionary mapping symbols to their market data
     * 
     * @example
     * const client = new MarketDataClient();
     * const data = await client.getMarketDataSnapshot("AAPL");
     * console.log(data["AAPL"]["86"]); // Last price
     */
    async getMarketDataSnapshot(symbols, fields = null) {
        if (typeof symbols === 'string') {
            symbols = [symbols];
        }
        
        if (!symbols || symbols.length === 0) {
            throw new InvalidSymbolError('At least one symbol must be provided');
        }
        
        // Default fields: bid, ask, last price, volume
        if (fields === null) {
            fields = ['31', '84', '86', '87'];
        }
        
        const results = {};
        
        for (const symbol of symbols) {
            try {
                // Get contract ID
                const conid = await this.getContractId(symbol);
                
                // Get market data snapshot
                const response = await this.client._makeRequest(
                    'GET',
                    'portal/iserver/marketdata/snapshot',
                    {
                        conids: conid.toString(),
                        fields: fields.join(',')
                    }
                );
                
                // Parse response
                if (response && response.length > 0) {
                    const marketData = response[0];
                    
                    // Convert numeric field keys to more readable names
                    const readableData = this._convertMarketDataFields(marketData);
                    results[symbol] = readableData;
                } else {
                    results[symbol] = {};
                }
                
            } catch (error) {
                console.error(`Failed to get market data for ${symbol}: ${error.message}`);
                results[symbol] = { error: error.message };
            }
        }
        
        return results;
    }
    
    /**
     * Get current stock price information for a symbol
     * 
     * @param {string} symbol - Stock symbol (e.g., "AAPL")
     * @returns {Promise<Object>} Dictionary with price information including:
     *                           - lastPrice: Last traded price
     *                           - bid: Current bid price
     *                           - ask: Current ask price
     *                           - volume: Trading volume
     *                           - change: Price change
     *                           - changePercent: Percentage change
     * 
     * @example
     * const client = new MarketDataClient();
     * const priceInfo = await client.getStockPrice("AAPL");
     * console.log(`AAPL last price: $${priceInfo.lastPrice}`);
     */
    async getStockPrice(symbol) {
        const marketData = await this.getMarketDataSnapshot(symbol);
        
        if (!(symbol in marketData)) {
            throw new InvalidSymbolError(`No market data available for symbol: ${symbol}`);
        }
        
        const data = marketData[symbol];
        
        if ('error' in data) {
            throw new IBSDKError(`Failed to get price for ${symbol}: ${data.error}`);
        }
        
        return data;
    }
    
    /**
     * Get stock prices for multiple symbols efficiently
     * 
     * @param {Array<string>} symbols - Array of stock symbols
     * @returns {Promise<Object>} Dictionary mapping symbols to their price information
     * 
     * @example
     * const client = new MarketDataClient();
     * const prices = await client.getMultipleStockPrices(["AAPL", "MSFT", "GOOGL"]);
     * for (const [symbol, data] of Object.entries(prices)) {
     *     console.log(`${symbol}: $${data.lastPrice || 'N/A'}`);
     * }
     */
    async getMultipleStockPrices(symbols) {
        return await this.getMarketDataSnapshot(symbols);
    }
    
    /**
     * Convert IB's numeric field codes to readable field names
     * 
     * @param {Object} rawData - Raw market data from IB API
     * @returns {Object} Dictionary with readable field names
     * @private
     */
    _convertMarketDataFields(rawData) {
        // Field mappings based on IB documentation
        const fieldMappings = {
            '31': 'bid',
            '84': 'ask',
            '86': 'lastPrice',
            '87': 'volume',
            '82': 'change',
            '83': 'changePercent',
            '70': 'high',
            '71': 'low',
            '7295': 'marketDataAvailability'
        };
        
        const converted = {};
        
        for (const [key, value] of Object.entries(rawData)) {
            if (key in fieldMappings) {
                converted[fieldMappings[key]] = value;
            } else {
                // Keep original key if no mapping found
                converted[key] = value;
            }
        }
        
        return converted;
    }
    
    /**
     * Get detailed contract information for a symbol
     * 
     * @param {string} symbol - Stock symbol
     * @returns {Promise<Object>} Detailed contract information
     */
    async getContractDetails(symbol) {
        const conid = await this.getContractId(symbol);
        
        const response = await this.client._makeRequest(
            'GET',
            `portal/iserver/contract/${conid}/info`
        );
        
        return response;
    }
    
    /**
     * Check if the market is currently open
     * 
     * @returns {Promise<boolean>} True if market is open, false otherwise
     */
    async isMarketOpen() {
        try {
            // Use a common stock to check market status
            const marketData = await this.getMarketDataSnapshot('SPY');
            const spyData = marketData.SPY || {};
            
            // Check if we have recent data (market data availability)
            const availability = spyData.marketDataAvailability;
            
            // If we get valid price data, market is likely open
            const lastPrice = spyData.lastPrice;
            
            return lastPrice !== null && lastPrice !== undefined && availability !== 'Delayed';
            
        } catch (error) {
            // If we can't determine, assume market is closed
            return false;
        }
    }
}
