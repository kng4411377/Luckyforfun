/**
 * Logging utility for the trading bot
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for trading logs
const tradingFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Create logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: tradingFormat,
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'trading.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        // Separate file for errors
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 3,
            tailable: true
        }),
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Trading-specific logging methods
 */
export class TradingLogger {
    static logTrade(action, symbol, quantity, price, orderId = null) {
        const message = `TRADE: ${action} ${quantity} ${symbol} @ $${price}${orderId ? ` (Order: ${orderId})` : ''}`;
        logger.info(message);
    }
    
    static logSignal(signal, symbol, data = {}) {
        const message = `SIGNAL: ${signal} for ${symbol} - ${JSON.stringify(data)}`;
        logger.info(message);
    }
    
    static logRisk(event, symbol, data = {}) {
        const message = `RISK: ${event} for ${symbol} - ${JSON.stringify(data)}`;
        logger.warn(message);
    }
    
    static logStrategy(event, data = {}) {
        const message = `STRATEGY: ${event} - ${JSON.stringify(data)}`;
        logger.info(message);
    }
    
    static logError(error, context = '') {
        const message = `ERROR${context ? ` (${context})` : ''}: ${error.message}`;
        logger.error(message, { stack: error.stack });
    }
    
    static logPerformance(metrics) {
        const message = `PERFORMANCE: ${JSON.stringify(metrics)}`;
        logger.info(message);
    }
    
    static logPosition(action, symbol, position) {
        const message = `POSITION: ${action} ${symbol} - ${JSON.stringify(position)}`;
        logger.info(message);
    }
}
