/**
 * Historical Data Client
 * 
 * Provides comprehensive historical market data retrieval from Interactive Brokers
 * Client Portal API with proper caching, rate limiting, and data processing.
 */

import { logger } from './logger.js';

export class HistoricalDataClient {
    constructor(ibClient) {
        this.client = ibClient;
        this.contractCache = new Map();
        this.dataCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Get historical data for a symbol
     * 
     * @param {string} symbol - Stock symbol (e.g., "AAPL")
     * @param {string} period - Time period: '1d', '7d', '1m', '3m', '6m', '1y', '2y', '5y'
     * @param {string} barSize - Bar size: '1min', '5min', '15min', '30min', '1h', '1d', '1w', '1m'
     * @param {boolean} outsideRth - Include outside regular trading hours
     * @returns {Promise<Object>} Historical data with OHLCV bars
     */
    async getHistoricalData(symbol, period = '1d', barSize = '5min', outsideRth = false) {
        try {
            const cacheKey = `${symbol}_${period}_${barSize}_${outsideRth}`;
            
            // Check cache first
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                logger.info(`📊 Using cached historical data for ${symbol}`);
                return cached;
            }

            logger.info(`📈 Fetching historical data for ${symbol} (${period}, ${barSize})`);

            // Get contract ID
            const contractId = await this.getContractId(symbol);
            
            // Convert period and barSize to IB API format
            const ibPeriod = this.convertPeriod(period);
            const ibBarLength = this.convertBarSize(barSize);

            // Make API request
            const response = await this.client._makeRequest(
                'GET',
                'portal/iserver/marketdata/history',
                {
                    conid: contractId,
                    period: ibPeriod,
                    bar: ibBarLength,
                    outsideRth: outsideRth ? 'true' : 'false'
                }
            );

            if (!response || !response.data) {
                throw new Error(`No historical data received for ${symbol}`);
            }

            // Process and format the data
            const processedData = this.processHistoricalData(response, symbol);
            
            // Cache the result
            this.cacheData(cacheKey, processedData);
            
            logger.info(`✅ Retrieved ${processedData.bars.length} bars for ${symbol}`);
            return processedData;

        } catch (error) {
            logger.error(`❌ Error getting historical data for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Get multiple symbols' historical data in parallel
     */
    async getMultipleHistoricalData(symbols, period = '1d', barSize = '5min', outsideRth = false) {
        const results = {};
        const promises = [];

        for (const symbol of symbols) {
            promises.push(
                this.getHistoricalData(symbol, period, barSize, outsideRth)
                    .then(data => ({ symbol, data }))
                    .catch(error => ({ symbol, error: error.message }))
            );
            
            // Rate limiting - stagger requests
            await this.sleep(200);
        }

        const responses = await Promise.all(promises);
        
        for (const response of responses) {
            results[response.symbol] = response.error ? 
                { error: response.error } : response.data;
        }

        return results;
    }

    /**
     * Get contract ID for a symbol
     */
    async getContractId(symbol) {
        if (this.contractCache.has(symbol)) {
            return this.contractCache.get(symbol);
        }

        try {
            const response = await this.client._makeRequest(
                'GET',
                'portal/iserver/secdef/search',
                { symbol: symbol }
            );

            if (!response || response.length === 0) {
                throw new Error(`No contract found for symbol: ${symbol}`);
            }

            // Find the best match (usually first one for stocks)
            const contract = response.find(c => c.secType === 'STK') || response[0];
            const contractId = contract.conid;

            this.contractCache.set(symbol, contractId);
            return contractId;

        } catch (error) {
            throw new Error(`Failed to get contract ID for ${symbol}: ${error.message}`);
        }
    }

    /**
     * Process raw historical data from IB API
     */
    processHistoricalData(response, symbol) {
        const bars = response.data.map(bar => ({
            timestamp: bar.t,
            datetime: new Date(bar.t).toISOString(),
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v || 0
        }));

        return {
            symbol: symbol,
            metadata: {
                symbol: response.symbol,
                description: response.text,
                period: response.timePeriod,
                barLength: response.barLength,
                startTime: response.startTime,
                totalBars: response.points,
                priceFactor: response.priceFactor,
                volumeFactor: response.volumeFactor,
                outsideRth: response.outsideRth
            },
            bars: bars,
            summary: this.calculateSummaryStats(bars)
        };
    }

    /**
     * Calculate summary statistics for the data
     */
    calculateSummaryStats(bars) {
        if (bars.length === 0) return null;

        const prices = bars.map(b => b.close);
        const volumes = bars.map(b => b.volume);
        
        const firstPrice = bars[0].close;
        const lastPrice = bars[bars.length - 1].close;
        const change = lastPrice - firstPrice;
        const changePercent = (change / firstPrice) * 100;

        const high = Math.max(...bars.map(b => b.high));
        const low = Math.min(...bars.map(b => b.low));
        const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
        const avgVolume = totalVolume / bars.length;

        return {
            firstPrice,
            lastPrice,
            change,
            changePercent,
            high,
            low,
            totalVolume,
            avgVolume,
            volatility: this.calculateVolatility(prices)
        };
    }

    /**
     * Calculate price volatility (standard deviation of returns)
     */
    calculateVolatility(prices) {
        if (prices.length < 2) return 0;

        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }

        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance) * 100; // Convert to percentage
    }

    /**
     * Get technical indicators for historical data
     */
    async getHistoricalWithIndicators(symbol, period = '1d', barSize = '5min') {
        const data = await this.getHistoricalData(symbol, period, barSize);
        
        if (!data.bars || data.bars.length === 0) {
            return data;
        }

        const bars = data.bars;
        const closes = bars.map(b => b.close);
        
        // Calculate technical indicators
        const indicators = {
            sma_20: this.calculateSMA(closes, 20),
            sma_50: this.calculateSMA(closes, 50),
            ema_12: this.calculateEMA(closes, 12),
            ema_26: this.calculateEMA(closes, 26),
            rsi_14: this.calculateRSI(closes, 14),
            bollinger: this.calculateBollingerBands(closes, 20, 2),
            macd: this.calculateMACD(closes)
        };

        return {
            ...data,
            indicators,
            technicalSummary: this.generateTechnicalSummary(closes, indicators)
        };
    }

    /**
     * Simple Moving Average
     */
    calculateSMA(prices, period) {
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    /**
     * Exponential Moving Average
     */
    calculateEMA(prices, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA for first value
        ema[0] = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        }
        
        return ema;
    }

    /**
     * Relative Strength Index
     */
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return [];

        const gains = [];
        const losses = [];

        // Calculate gains and losses
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        const rsi = [];
        
        // Calculate initial average gain and loss
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        rsi.push(100 - (100 / (1 + (avgGain / avgLoss))));

        // Calculate subsequent RSI values
        for (let i = period; i < gains.length; i++) {
            avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
            rsi.push(100 - (100 / (1 + (avgGain / avgLoss))));
        }

        return rsi;
    }

    /**
     * Bollinger Bands
     */
    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(prices, period);
        const bands = { upper: [], middle: [], lower: [] };

        for (let i = 0; i < sma.length; i++) {
            const slice = prices.slice(i, i + period);
            const mean = sma[i];
            const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
            const standardDeviation = Math.sqrt(variance);

            bands.middle.push(mean);
            bands.upper.push(mean + (standardDeviation * stdDev));
            bands.lower.push(mean - (standardDeviation * stdDev));
        }

        return bands;
    }

    /**
     * MACD (Moving Average Convergence Divergence)
     */
    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        
        const macdLine = [];
        const minLength = Math.min(ema12.length, ema26.length);
        
        for (let i = 0; i < minLength; i++) {
            macdLine.push(ema12[i] - ema26[i]);
        }
        
        const signalLine = this.calculateEMA(macdLine, 9);
        const histogram = [];
        
        for (let i = 0; i < signalLine.length; i++) {
            histogram.push(macdLine[i] - signalLine[i]);
        }

        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }

    /**
     * Generate technical analysis summary
     */
    generateTechnicalSummary(prices, indicators) {
        const currentPrice = prices[prices.length - 1];
        const summary = {
            trend: 'NEUTRAL',
            momentum: 'NEUTRAL',
            volatility: 'MEDIUM',
            signals: []
        };

        // Trend analysis
        if (indicators.sma_20.length > 0 && indicators.sma_50.length > 0) {
            const sma20 = indicators.sma_20[indicators.sma_20.length - 1];
            const sma50 = indicators.sma_50[indicators.sma_50.length - 1];
            
            if (currentPrice > sma20 && sma20 > sma50) {
                summary.trend = 'BULLISH';
                summary.signals.push('Price above SMA(20) and SMA(50)');
            } else if (currentPrice < sma20 && sma20 < sma50) {
                summary.trend = 'BEARISH';
                summary.signals.push('Price below SMA(20) and SMA(50)');
            }
        }

        // RSI analysis
        if (indicators.rsi_14.length > 0) {
            const rsi = indicators.rsi_14[indicators.rsi_14.length - 1];
            
            if (rsi > 70) {
                summary.momentum = 'OVERBOUGHT';
                summary.signals.push(`RSI overbought (${rsi.toFixed(1)})`);
            } else if (rsi < 30) {
                summary.momentum = 'OVERSOLD';
                summary.signals.push(`RSI oversold (${rsi.toFixed(1)})`);
            }
        }

        // MACD analysis
        if (indicators.macd.histogram.length > 1) {
            const currentHist = indicators.macd.histogram[indicators.macd.histogram.length - 1];
            const prevHist = indicators.macd.histogram[indicators.macd.histogram.length - 2];
            
            if (currentHist > 0 && prevHist <= 0) {
                summary.signals.push('MACD bullish crossover');
            } else if (currentHist < 0 && prevHist >= 0) {
                summary.signals.push('MACD bearish crossover');
            }
        }

        return summary;
    }

    /**
     * Convert period format
     */
    convertPeriod(period) {
        const periodMap = {
            '1d': '1d',
            '7d': '7d', 
            '1m': '1m',
            '3m': '3m',
            '6m': '6m',
            '1y': '1y',
            '2y': '2y',
            '5y': '5y'
        };
        return periodMap[period] || '1d';
    }

    /**
     * Convert bar size format
     */
    convertBarSize(barSize) {
        const barSizeMap = {
            '1min': '1min',
            '5min': '5min',
            '15min': '15min',
            '30min': '30min',
            '1h': '1h',
            '1d': '1d',
            '1w': '1w',
            '1m': '1m'
        };
        return barSizeMap[barSize] || '5min';
    }

    /**
     * Cache management
     */
    getCachedData(key) {
        const cached = this.dataCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    cacheData(key, data) {
        this.dataCache.set(key, {
            data: data,
            timestamp: Date.now()
        });

        // Cleanup old cache entries
        if (this.dataCache.size > 100) {
            const oldestKey = this.dataCache.keys().next().value;
            this.dataCache.delete(oldestKey);
        }
    }

    /**
     * Utility methods
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get available periods and bar sizes
     */
    getAvailableOptions() {
        return {
            periods: ['1d', '7d', '1m', '3m', '6m', '1y', '2y', '5y'],
            barSizes: ['1min', '5min', '15min', '30min', '1h', '1d', '1w', '1m'],
            description: {
                periods: {
                    '1d': '1 Day',
                    '7d': '1 Week', 
                    '1m': '1 Month',
                    '3m': '3 Months',
                    '6m': '6 Months',
                    '1y': '1 Year',
                    '2y': '2 Years',
                    '5y': '5 Years'
                },
                barSizes: {
                    '1min': '1 Minute',
                    '5min': '5 Minutes',
                    '15min': '15 Minutes',
                    '30min': '30 Minutes',
                    '1h': '1 Hour',
                    '1d': '1 Day',
                    '1w': '1 Week',
                    '1m': '1 Month'
                }
            }
        };
    }
}
