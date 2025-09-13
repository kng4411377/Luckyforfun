/**
 * Configuration settings for the IB SDK
 */

export class Config {
    /**
     * Default IB Gateway settings for paper trading
     */
    static DEFAULT_HOST = '127.0.0.1';
    static DEFAULT_PORT = 5000;
    static DEFAULT_BASE_URL = `https://${Config.DEFAULT_HOST}:${Config.DEFAULT_PORT}/v1/api`;
    
    /**
     * Rate limiting settings (per IB documentation)
     */
    static DEFAULT_RATE_LIMIT = 1.0; // 1 request per second
    static MAX_RATE_LIMIT = 5.0;     // 5 requests per second max per endpoint
    
    /**
     * Session settings
     */
    static SESSION_TIMEOUT = 900; // 15 minutes in seconds
    
    /**
     * Paper trading account prefix
     */
    static PAPER_ACCOUNT_PREFIX = 'DU';
    
    /**
     * Initialize configuration
     * 
     * @param {Object} options - Configuration options
     * @param {string} [options.host] - IB Gateway host (default: 127.0.0.1)
     * @param {number} [options.port] - IB Gateway port (default: 5000)
     * @param {string} [options.baseUrl] - Full base URL (overrides host/port if provided)
     * @param {number} [options.rateLimit=1.0] - Rate limit in requests per second
     * @param {boolean} [options.verifySsl=false] - Whether to verify SSL certificates
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds
     */
    constructor(options = {}) {
        this.host = options.host || process.env.IB_HOST || Config.DEFAULT_HOST;
        this.port = options.port || parseInt(process.env.IB_PORT) || Config.DEFAULT_PORT;
        
        if (options.baseUrl) {
            this.baseUrl = options.baseUrl;
        } else {
            this.baseUrl = `https://${this.host}:${this.port}/v1/api`;
        }
        
        this.rateLimit = Math.min(options.rateLimit || Config.DEFAULT_RATE_LIMIT, Config.MAX_RATE_LIMIT);
        this.verifySsl = options.verifySsl !== undefined ? options.verifySsl : false;
        this.timeout = options.timeout || 30000; // 30 seconds
    }
    
    /**
     * Get string representation of config
     * @returns {string}
     */
    toString() {
        return `Config(host='${this.host}', port=${this.port}, rateLimit=${this.rateLimit}, verifySsl=${this.verifySsl})`;
    }
}
