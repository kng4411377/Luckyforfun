/**
 * Order management client for placing and managing orders
 */

import { IBClient } from './client.js';
import { Config } from './config.js';
import { IBSDKError, AuthenticationError, InvalidSymbolError } from './exceptions.js';

/**
 * Order types supported by IB
 */
export const OrderTypes = {
    MARKET: 'MKT',
    LIMIT: 'LMT', 
    STOP: 'STP',
    STOP_LIMIT: 'STP LMT',
    TRAILING_STOP: 'TRAIL',
    MARKET_ON_CLOSE: 'MOC',
    LIMIT_ON_CLOSE: 'LOC',
    PEGGED_TO_MARKET: 'PEG MKT',
    RELATIVE: 'REL',
    MIDPOINT: 'MIDPRICE'
};

/**
 * Order sides
 */
export const OrderSides = {
    BUY: 'BUY',
    SELL: 'SELL'
};

/**
 * Time in force options
 */
export const TimeInForce = {
    DAY: 'DAY',
    GOOD_TILL_CANCEL: 'GTC',
    IMMEDIATE_OR_CANCEL: 'IOC',
    FILL_OR_KILL: 'FOK',
    GOOD_TILL_DATE: 'GTD'
};

export class OrderClient {
    /**
     * Client for placing and managing orders with Interactive Brokers
     * 
     * This client provides methods for placing various order types,
     * monitoring orders, and managing positions.
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
     * Get contract ID for a stock symbol (with caching)
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
        const response = await this.client._makeRequest(
            'GET',
            'portal/iserver/secdef/search',
            { symbol }
        );
        
        if (!response || response.length === 0) {
            throw new InvalidSymbolError(`No contracts found for symbol: ${symbol}`);
        }
        
        // Find stock contract
        for (const contract of response) {
            if (contract.secType === 'STK') {
                const conid = contract.conid;
                if (conid) {
                    this._contractCache.set(symbol, conid);
                    return conid;
                }
            }
        }
        
        // Fallback to first contract
        if (response.length > 0 && response[0].conid) {
            const conid = response[0].conid;
            this._contractCache.set(symbol, conid);
            return conid;
        }
        
        throw new InvalidSymbolError(`No valid contract ID found for symbol: ${symbol}`);
    }
    
    /**
     * Place a market order
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {Object} [options] - Additional order options
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order response
     * 
     * @example
     * const order = await orderClient.placeMarketOrder('AAPL', 'BUY', 100);
     */
    async placeMarketOrder(symbol, side, quantity, options = {}) {
        const orderData = {
            orderType: OrderTypes.MARKET,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        return await this._placeOrder(symbol, orderData, options);
    }
    
    /**
     * Place a limit order
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {number} price - Limit price
     * @param {Object} [options] - Additional order options
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order response
     * 
     * @example
     * const order = await orderClient.placeLimitOrder('AAPL', 'BUY', 100, 150.00);
     */
    async placeLimitOrder(symbol, side, quantity, price, options = {}) {
        const orderData = {
            orderType: OrderTypes.LIMIT,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            price: price,
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        return await this._placeOrder(symbol, orderData, options);
    }
    
    /**
     * Place a stop order
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {number} stopPrice - Stop price
     * @param {Object} [options] - Additional order options
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order response
     * 
     * @example
     * const order = await orderClient.placeStopOrder('AAPL', 'SELL', 100, 140.00);
     */
    async placeStopOrder(symbol, side, quantity, stopPrice, options = {}) {
        const orderData = {
            orderType: OrderTypes.STOP,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            auxPrice: stopPrice, // Stop price goes in auxPrice field
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        return await this._placeOrder(symbol, orderData, options);
    }
    
    /**
     * Place a stop-limit order
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {number} stopPrice - Stop price
     * @param {number} limitPrice - Limit price
     * @param {Object} [options] - Additional order options
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order response
     * 
     * @example
     * const order = await orderClient.placeStopLimitOrder('AAPL', 'SELL', 100, 140.00, 139.50);
     */
    async placeStopLimitOrder(symbol, side, quantity, stopPrice, limitPrice, options = {}) {
        const orderData = {
            orderType: OrderTypes.STOP_LIMIT,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            price: limitPrice,
            auxPrice: stopPrice,
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        return await this._placeOrder(symbol, orderData, options);
    }
    
    /**
     * Place a trailing stop order
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {number} trailAmount - Trail amount (in dollars or percentage)
     * @param {Object} [options] - Additional order options
     * @param {boolean} [options.isPercentage=false] - Whether trail amount is percentage
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order response
     * 
     * @example
     * // Trail by $2.00
     * const order1 = await orderClient.placeTrailingStopOrder('AAPL', 'SELL', 100, 2.00);
     * 
     * // Trail by 2%
     * const order2 = await orderClient.placeTrailingStopOrder('AAPL', 'SELL', 100, 2, {isPercentage: true});
     */
    async placeTrailingStopOrder(symbol, side, quantity, trailAmount, options = {}) {
        const orderData = {
            orderType: OrderTypes.TRAILING_STOP,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        // Set trail amount based on whether it's percentage or dollar amount
        if (options.isPercentage) {
            orderData.trailingPercent = trailAmount;
        } else {
            orderData.trailingAmt = trailAmount;
        }
        
        return await this._placeOrder(symbol, orderData, options);
    }
    
    /**
     * Place a bracket order (parent order with profit target and stop loss)
     * 
     * @param {string} symbol - Stock symbol
     * @param {string} side - Order side ('BUY' or 'SELL')
     * @param {number} quantity - Number of shares
     * @param {Object} parentOrder - Parent order configuration
     * @param {string} parentOrder.orderType - Parent order type ('MKT' or 'LMT')
     * @param {number} [parentOrder.price] - Limit price (required for limit orders)
     * @param {Object} profitTarget - Profit target configuration
     * @param {number} profitTarget.price - Profit target price
     * @param {Object} stopLoss - Stop loss configuration
     * @param {number} stopLoss.price - Stop loss price
     * @param {Object} [options] - Additional order options
     * @param {string} [options.timeInForce='DAY'] - Time in force
     * @param {string} [options.accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Bracket order response
     * 
     * @example
     * // Market order bracket
     * const bracket1 = await orderClient.placeBracketOrder(
     *     'AAPL', 'BUY', 100,
     *     { orderType: 'MKT' },
     *     { price: 160.00 },  // Take profit at $160
     *     { price: 140.00 }   // Stop loss at $140
     * );
     * 
     * // Limit order bracket
     * const bracket2 = await orderClient.placeBracketOrder(
     *     'AAPL', 'BUY', 100,
     *     { orderType: 'LMT', price: 150.00 },
     *     { price: 160.00 },  // Take profit at $160
     *     { price: 140.00 }   // Stop loss at $140
     * );
     */
    async placeBracketOrder(symbol, side, quantity, parentOrder, profitTarget, stopLoss, options = {}) {
        const conid = await this.getContractId(symbol);
        const accountId = options.accountId || this.client.accountId;
        
        if (!accountId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        // Determine opposite side for child orders
        const oppositeSide = side.toUpperCase() === OrderSides.BUY ? OrderSides.SELL : OrderSides.BUY;
        
        // Build parent order
        const parentOrderData = {
            conid: conid,
            orderType: parentOrder.orderType,
            side: side.toUpperCase(),
            quantity: Math.abs(quantity),
            timeInForce: options.timeInForce || TimeInForce.DAY
        };
        
        if (parentOrder.orderType === OrderTypes.LIMIT && parentOrder.price) {
            parentOrderData.price = parentOrder.price;
        }
        
        // Build profit target order (limit order)
        const profitTargetOrder = {
            conid: conid,
            orderType: OrderTypes.LIMIT,
            side: oppositeSide,
            quantity: Math.abs(quantity),
            price: profitTarget.price,
            timeInForce: options.timeInForce || TimeInForce.DAY,
            parentId: 'PARENT_ORDER_ID' // Will be replaced with actual parent ID
        };
        
        // Build stop loss order (stop order)
        const stopLossOrder = {
            conid: conid,
            orderType: OrderTypes.STOP,
            side: oppositeSide,
            quantity: Math.abs(quantity),
            auxPrice: stopLoss.price,
            timeInForce: options.timeInForce || TimeInForce.DAY,
            parentId: 'PARENT_ORDER_ID' // Will be replaced with actual parent ID
        };
        
        // Create bracket order structure
        const bracketOrderData = {
            orders: [
                parentOrderData,
                profitTargetOrder,
                stopLossOrder
            ]
        };
        
        try {
            const response = await this.client._makeRequest(
                'POST',
                `portal/iserver/account/${accountId}/orders/bracket`,
                null,
                bracketOrderData
            );
            
            console.log(`✅ Bracket order placed for ${symbol}: ${side} ${quantity} shares`);
            return response;
            
        } catch (error) {
            console.error(`❌ Failed to place bracket order for ${symbol}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Internal method to place an order
     * 
     * @param {string} symbol - Stock symbol
     * @param {Object} orderData - Order data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Order response
     * @private
     */
    async _placeOrder(symbol, orderData, options = {}) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to place orders');
        }
        
        const conid = await this.getContractId(symbol);
        const accountId = options.accountId || this.client.accountId;
        
        if (!accountId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        // Build complete order data
        const completeOrderData = {
            conid: conid,
            ...orderData
        };
        
        try {
            // First, preview the order (optional but recommended)
            if (options.preview !== false) {
                await this._previewOrder(accountId, completeOrderData);
            }
            
            // Place the actual order
            const response = await this.client._makeRequest(
                'POST',
                `portal/iserver/account/${accountId}/orders`,
                null,
                { orders: [completeOrderData] }
            );
            
            console.log(`✅ Order placed for ${symbol}: ${orderData.side} ${orderData.quantity} shares`);
            return response;
            
        } catch (error) {
            console.error(`❌ Failed to place order for ${symbol}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Preview an order before placing it
     * 
     * @param {string} accountId - Account ID
     * @param {Object} orderData - Order data
     * @returns {Promise<Object>} Preview response
     * @private
     */
    async _previewOrder(accountId, orderData) {
        return await this.client._makeRequest(
            'POST',
            `portal/iserver/account/${accountId}/orders/whatif`,
            null,
            { orders: [orderData] }
        );
    }
    
    /**
     * Get live orders for the account
     * 
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Array>} List of live orders
     */
    async getLiveOrders(accountId = null) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to get orders');
        }
        
        const accId = accountId || this.client.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this.client._makeRequest('GET', `portal/iserver/account/${accId}/orders`);
    }
    
    /**
     * Cancel an order
     * 
     * @param {string} orderId - Order ID to cancel
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelOrder(orderId, accountId = null) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to cancel orders');
        }
        
        const accId = accountId || this.client.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this.client._makeRequest(
            'DELETE',
            `portal/iserver/account/${accId}/order/${orderId}`
        );
    }
    
    /**
     * Modify an existing order
     * 
     * @param {string} orderId - Order ID to modify
     * @param {Object} modifications - Order modifications
     * @param {number} [modifications.quantity] - New quantity
     * @param {number} [modifications.price] - New price (for limit orders)
     * @param {number} [modifications.auxPrice] - New aux price (for stop orders)
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Modification response
     */
    async modifyOrder(orderId, modifications, accountId = null) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to modify orders');
        }
        
        const accId = accountId || this.client.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this.client._makeRequest(
            'POST',
            `portal/iserver/account/${accId}/order/${orderId}`,
            null,
            modifications
        );
    }
    
    /**
     * Get order status
     * 
     * @param {string} orderId - Order ID
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Order status
     */
    async getOrderStatus(orderId, accountId = null) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to get order status');
        }
        
        const accId = accountId || this.client.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this.client._makeRequest(
            'GET',
            `portal/iserver/account/${accId}/order/${orderId}`
        );
    }
    
    /**
     * Get recent executions/trades
     * 
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @param {number} [days=1] - Number of days to look back
     * @returns {Promise<Array>} List of executions
     */
    async getExecutions(accountId = null, days = 1) {
        if (!this.client.authenticated) {
            throw new AuthenticationError('Must be authenticated to get executions');
        }
        
        const accId = accountId || this.client.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this.client._makeRequest(
            'GET',
            `portal/iserver/account/${accId}/trades`,
            { days: days }
        );
    }
}
