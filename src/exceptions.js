/**
 * Custom exceptions for the IB SDK
 */

/**
 * Base exception for IB SDK errors
 */
export class IBSDKError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IBSDKError';
    }
}

/**
 * Raised when authentication fails
 */
export class AuthenticationError extends IBSDKError {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * Raised when rate limit is exceeded
 */
export class RateLimitError extends IBSDKError {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
    }
}

/**
 * Raised when API returns an error
 */
export class APIError extends IBSDKError {
    constructor(message, statusCode = null, responseData = null) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.responseData = responseData;
    }
}

/**
 * Raised when connection to IB Gateway fails
 */
export class ConnectionError extends IBSDKError {
    constructor(message) {
        super(message);
        this.name = 'ConnectionError';
    }
}

/**
 * Raised when an invalid stock symbol is provided
 */
export class InvalidSymbolError extends IBSDKError {
    constructor(message) {
        super(message);
        this.name = 'InvalidSymbolError';
    }
}
