/**
 * Main client class for Interactive Brokers Client Portal API
 */

import axios from 'axios';
import https from 'https';
import { Config } from './config.js';
import { 
    IBSDKError, 
    AuthenticationError, 
    APIError, 
    ConnectionError, 
    RateLimitError 
} from './exceptions.js';

export class IBClient {
    /**
     * Main client for Interactive Brokers Client Portal API
     * 
     * This client handles authentication, session management, and provides
     * a foundation for making API calls to the IB Client Portal.
     * 
     * @param {Config} [config] - Configuration object. If null, uses default config.
     */
    constructor(config = null) {
        this.config = config || new Config();
        this.lastRequestTime = 0;
        this.authenticated = false;
        this.accountId = null;
        
        // Create axios instance with custom configuration
        this.httpClient = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'IB-SDK/1.0.0',
                'Content-Type': 'application/json'
            },
            // Disable SSL verification for IB Gateway (uses self-signed certs)
            httpsAgent: new https.Agent({
                rejectUnauthorized: this.config.verifySsl
            })
        });
        
        // Setup request interceptor for rate limiting
        this.httpClient.interceptors.request.use(
            (config) => {
                this._rateLimit();
                return config;
            },
            (error) => Promise.reject(error)
        );
        
        // Setup response interceptor for error handling
        this.httpClient.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response) {
                    const { status, data } = error.response;
                    
                    // Handle rate limiting
                    if (status === 429) {
                        throw new RateLimitError('Rate limit exceeded');
                    }
                    
                    // Handle authentication errors
                    if (status === 401) {
                        this.authenticated = false;
                        throw new AuthenticationError('Authentication required or expired');
                    }
                    
                    // Handle other HTTP errors
                    let errorMsg = `API request failed with status ${status}`;
                    if (data && data.error) {
                        errorMsg = data.error;
                    } else if (typeof data === 'string') {
                        errorMsg = data;
                    }
                    
                    throw new APIError(errorMsg, status, data);
                } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                    throw new ConnectionError(`Failed to connect to IB Gateway: ${error.message}`);
                } else if (error.code === 'ECONNABORTED') {
                    throw new ConnectionError(`Request timeout: ${error.message}`);
                } else {
                    throw new IBSDKError(`Request failed: ${error.message}`);
                }
            }
        );
    }
    
    /**
     * Enforce rate limiting
     * @private
     */
    _rateLimit() {
        const currentTime = Date.now();
        const timeSinceLastRequest = currentTime - this.lastRequestTime;
        const minInterval = 1000 / this.config.rateLimit; // Convert to milliseconds
        
        if (timeSinceLastRequest < minInterval) {
            const sleepTime = minInterval - timeSinceLastRequest;
            console.debug(`Rate limiting: sleeping for ${sleepTime}ms`);
            
            // Synchronous sleep using busy wait (not ideal but simple)
            const start = Date.now();
            while (Date.now() - start < sleepTime) {
                // Busy wait
            }
        }
        
        this.lastRequestTime = Date.now();
    }
    
    /**
     * Make a rate-limited HTTP request to the IB API
     * 
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} [params] - Query parameters
     * @param {Object} [data] - Request body data
     * @param {Object} [headers] - Additional headers
     * @returns {Promise<Object>} Response data
     * @throws {APIError} If the API returns an error
     * @throws {ConnectionError} If connection fails
     * @throws {RateLimitError} If rate limit is exceeded
     */
    async _makeRequest(method, endpoint, params = null, data = null, headers = null) {
        const config = {
            method: method.toLowerCase(),
            url: `/${endpoint.replace(/^\//, '')}`, // Remove leading slash
            params,
            data,
            headers: headers || {}
        };
        
        console.debug(`Making ${method} request to ${endpoint}`);
        
        try {
            const response = await this.httpClient.request(config);
            return response.data || {};
        } catch (error) {
            console.error(`Request failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Check if the IB Gateway is running and accessible
     * 
     * @returns {Promise<Object>} Health status information
     */
    async checkHealth() {
        try {
            const response = await this._makeRequest('GET', 'portal/iserver/auth/status');
            console.info('IB Gateway health check successful');
            return response;
        } catch (error) {
            console.error(`IB Gateway health check failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get current authentication status
     * 
     * @returns {Promise<Object>} Authentication status information
     */
    async getAuthStatus() {
        const response = await this._makeRequest('GET', 'portal/iserver/auth/status');
        
        // Update authentication state
        this.authenticated = response.authenticated || false;
        
        return response;
    }
    
    /**
     * Trigger reauthentication
     * 
     * @returns {Promise<Object>} Reauthentication response
     */
    async reauthenticate() {
        const response = await this._makeRequest('POST', 'portal/iserver/reauthenticate');
        
        // Check if we're now authenticated
        const authStatus = await this.getAuthStatus();
        this.authenticated = authStatus.authenticated || false;
        
        return response;
    }
    
    /**
     * Get list of available accounts
     * 
     * @returns {Promise<Array>} List of account information
     * @throws {AuthenticationError} If not authenticated
     */
    async getAccounts() {
        if (!this.authenticated) {
            throw new AuthenticationError('Must be authenticated to get accounts');
        }
        
        const response = await this._makeRequest('GET', 'portal/portfolio/accounts');
        
        // Store paper trading account if found
        if (Array.isArray(response)) {
            for (const account of response) {
                const accountId = account.accountId || '';
                if (accountId.startsWith(this.config.constructor.PAPER_ACCOUNT_PREFIX)) {
                    this.accountId = accountId;
                    console.info(`Found paper trading account: ${accountId}`);
                    break;
                }
            }
        }
        
        return response;
    }
    
    /**
     * Get account summary information
     * 
     * @param {string} [accountId] - Account ID (uses default if not provided)
     * @returns {Promise<Object>} Account summary data
     * @throws {AuthenticationError} If not authenticated
     * @throws {IBSDKError} If no account ID available
     */
    async getAccountSummary(accountId = null) {
        if (!this.authenticated) {
            throw new AuthenticationError('Must be authenticated to get account summary');
        }
        
        const accId = accountId || this.accountId;
        if (!accId) {
            throw new IBSDKError('No account ID available. Call getAccounts() first.');
        }
        
        return await this._makeRequest('GET', `portal/portfolio/${accId}/summary`);
    }
    
    /**
     * Logout and invalidate session
     * 
     * @returns {Promise<Object>} Logout response
     */
    async logout() {
        const response = await this._makeRequest('POST', 'portal/logout');
        this.authenticated = false;
        this.accountId = null;
        return response;
    }
}
