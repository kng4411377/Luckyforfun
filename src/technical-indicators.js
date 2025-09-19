/**
 * Technical indicators for trading strategies
 */

export class TechnicalIndicators {
    /**
     * Calculate Simple Moving Average
     * @param {Array<number>} prices - Array of prices
     * @param {number} period - Period for SMA
     * @returns {number} SMA value
     */
    static sma(prices, period) {
        if (prices.length < period) return null;
        
        const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
        return sum / period;
    }
    
    /**
     * Calculate Exponential Moving Average
     * @param {Array<number>} prices - Array of prices
     * @param {number} period - Period for EMA
     * @returns {number} EMA value
     */
    static ema(prices, period) {
        if (prices.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((acc, price) => acc + price, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }
    
    /**
     * Calculate Relative Strength Index (RSI)
     * @param {Array<number>} prices - Array of prices
     * @param {number} period - Period for RSI (default 14)
     * @returns {number} RSI value
     */
    static rsi(prices, period = 14) {
        if (prices.length < period + 1) return null;
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        const gains = changes.map(change => change > 0 ? change : 0);
        const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
        
        const avgGain = gains.slice(-period).reduce((acc, gain) => acc + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((acc, loss) => acc + loss, 0) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    /**
     * Calculate Bollinger Bands
     * @param {Array<number>} prices - Array of prices
     * @param {number} period - Period for moving average
     * @param {number} stdDev - Standard deviation multiplier
     * @returns {Object} Bollinger bands {upper, middle, lower}
     */
    static bollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;
        
        const sma = this.sma(prices, period);
        const recentPrices = prices.slice(-period);
        
        // Calculate standard deviation
        const variance = recentPrices.reduce((acc, price) => {
            return acc + Math.pow(price - sma, 2);
        }, 0) / period;
        
        const standardDeviation = Math.sqrt(variance);
        
        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }
    
    /**
     * Calculate MACD (Moving Average Convergence Divergence)
     * @param {Array<number>} prices - Array of prices
     * @param {number} fastPeriod - Fast EMA period (default 12)
     * @param {number} slowPeriod - Slow EMA period (default 26)
     * @param {number} signalPeriod - Signal line EMA period (default 9)
     * @returns {Object} MACD {macd, signal, histogram}
     */
    static macd(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (prices.length < slowPeriod) return null;
        
        const fastEMA = this.ema(prices, fastPeriod);
        const slowEMA = this.ema(prices, slowPeriod);
        
        if (!fastEMA || !slowEMA) return null;
        
        const macdLine = fastEMA - slowEMA;
        
        // For signal line, we'd need historical MACD values
        // This is a simplified version
        return {
            macd: macdLine,
            signal: null, // Would need historical data
            histogram: null
        };
    }
    
    /**
     * Calculate momentum (rate of change)
     * @param {Array<number>} prices - Array of prices
     * @param {number} period - Period for momentum calculation
     * @returns {number} Momentum percentage
     */
    static momentum(prices, period) {
        if (prices.length < period + 1) return null;
        
        const currentPrice = prices[prices.length - 1];
        const pastPrice = prices[prices.length - 1 - period];
        
        return ((currentPrice - pastPrice) / pastPrice) * 100;
    }
    
    /**
     * Calculate Average True Range (ATR)
     * @param {Array<Object>} candles - Array of OHLC candles
     * @param {number} period - Period for ATR
     * @returns {number} ATR value
     */
    static atr(candles, period = 14) {
        if (candles.length < period + 1) return null;
        
        const trueRanges = [];
        
        for (let i = 1; i < candles.length; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            
            const tr1 = current.high - current.low;
            const tr2 = Math.abs(current.high - previous.close);
            const tr3 = Math.abs(current.low - previous.close);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        return this.sma(trueRanges, period);
    }
    
    /**
     * Calculate Volume Weighted Average Price (VWAP)
     * @param {Array<Object>} candles - Array of OHLCV candles
     * @returns {number} VWAP value
     */
    static vwap(candles) {
        if (candles.length === 0) return null;
        
        let totalVolume = 0;
        let totalVolumePrice = 0;
        
        for (const candle of candles) {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            totalVolumePrice += typicalPrice * candle.volume;
            totalVolume += candle.volume;
        }
        
        return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
    }
    
    /**
     * Detect price patterns
     * @param {Array<number>} prices - Array of prices
     * @returns {Object} Pattern detection results
     */
    static detectPatterns(prices) {
        if (prices.length < 10) return {};
        
        const recent = prices.slice(-10);
        const momentum = this.momentum(prices, 5);
        const rsi = this.rsi(prices, 14);
        
        return {
            isUptrend: momentum > 2,
            isDowntrend: momentum < -2,
            isOversold: rsi < 30,
            isOverbought: rsi > 70,
            momentum: momentum,
            rsi: rsi
        };
    }
}
