/**
 * Mean Reversion Trading Strategy
 * 
 * This strategy looks for stocks that have moved significantly away from their
 * average price and bets on them returning to the mean.
 */

import { BaseStrategy } from '../src/base-strategy.js';
import { TechnicalIndicators } from '../src/technical-indicators.js';
import { TradingLogger } from '../src/logger.js';

export class MeanReversionStrategy extends BaseStrategy {
    constructor(config) {
        super('mean-reversion', config);
        
        // Strategy-specific metadata
        this.metadata = {
            version: '1.0.0',
            author: 'IB SDK Team',
            description: 'Mean reversion strategy using Bollinger Bands and RSI',
            timeframe: '15m',
            riskLevel: 'conservative',
            requiredIndicators: ['Bollinger Bands', 'RSI', 'SMA'],
            minHistoryRequired: 25
        };
    }
    
    /**
     * Initialize the mean reversion strategy
     */
    async initialize() {
        try {
            this.validateMeanReversionConfig();
            
            TradingLogger.logStrategy('Mean reversion strategy initialized', {
                bollingerPeriod: this.config.technicalIndicators?.bollinger?.period,
                rsiPeriod: this.config.technicalIndicators?.rsi?.period,
                meanReversionThreshold: this.config.meanReversion?.threshold
            });
            
            return true;
        } catch (error) {
            TradingLogger.logError(error, 'Mean reversion strategy initialization');
            return false;
        }
    }
    
    /**
     * Validate mean reversion specific configuration
     */
    validateMeanReversionConfig() {
        super.validateConfig();
        
        if (!this.config.meanReversion) {
            throw new Error('Mean reversion configuration is required');
        }
        
        if (!this.config.technicalIndicators?.bollinger) {
            throw new Error('Bollinger Bands configuration is required for mean reversion');
        }
    }
    
    /**
     * Get maximum history length required
     */
    getMaxHistoryLength() {
        const bollingerPeriod = this.config.technicalIndicators?.bollinger?.period || 20;
        const rsiPeriod = this.config.technicalIndicators?.rsi?.period || 14;
        const smaPeriod = this.config.technicalIndicators?.sma?.period || 20;
        
        return Math.max(bollingerPeriod, rsiPeriod, smaPeriod) + 10;
    }
    
    /**
     * Analyze symbol for mean reversion signals
     */
    analyze(symbol, marketData) {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < this.getMaxHistoryLength()) {
            return { signal: 'HOLD', strength: 0, reason: 'Insufficient data for mean reversion analysis' };
        }
        
        const prices = history.map(h => h.price);
        const currentPrice = marketData.lastPrice;
        
        // Calculate technical indicators
        const bollinger = TechnicalIndicators.bollingerBands(
            prices, 
            this.config.technicalIndicators.bollinger.period,
            this.config.technicalIndicators.bollinger.standardDeviations
        );
        
        const rsi = TechnicalIndicators.rsi(prices, this.config.technicalIndicators.rsi.period);
        const sma = TechnicalIndicators.sma(prices, this.config.technicalIndicators.sma?.period || 20);
        
        if (!bollinger || !rsi || !sma) {
            return { signal: 'HOLD', strength: 0, reason: 'Unable to calculate indicators' };
        }
        
        // Mean reversion logic
        return this.generateMeanReversionSignals({
            symbol,
            currentPrice,
            bollinger,
            rsi,
            sma,
            marketData
        });
    }
    
    /**
     * Generate mean reversion signals
     */
    generateMeanReversionSignals(data) {
        const { currentPrice, bollinger, rsi, sma } = data;
        
        let signal = 'HOLD';
        let strength = 0;
        let reasons = [];
        
        // Check if price is outside Bollinger Bands (mean reversion opportunity)
        const upperBandDistance = (currentPrice - bollinger.upper) / bollinger.upper;
        const lowerBandDistance = (bollinger.lower - currentPrice) / bollinger.lower;
        
        // Price above upper band - potential sell signal (revert down)
        if (currentPrice > bollinger.upper) {
            const overextension = upperBandDistance * 100;
            
            if (overextension > this.config.meanReversion.threshold) {
                signal = 'SELL';
                strength += Math.min(50, overextension * 10);
                reasons.push(`Price ${overextension.toFixed(2)}% above upper Bollinger Band`);
                
                // Confirm with RSI overbought
                if (rsi > this.config.technicalIndicators.rsi.overbought) {
                    strength += 20;
                    reasons.push(`RSI overbought: ${rsi.toFixed(2)}`);
                }
            }
        }
        // Price below lower band - potential buy signal (revert up)
        else if (currentPrice < bollinger.lower) {
            const overextension = lowerBandDistance * 100;
            
            if (overextension > this.config.meanReversion.threshold) {
                signal = 'BUY';
                strength += Math.min(50, overextension * 10);
                reasons.push(`Price ${overextension.toFixed(2)}% below lower Bollinger Band`);
                
                // Confirm with RSI oversold
                if (rsi < this.config.technicalIndicators.rsi.oversold) {
                    strength += 20;
                    reasons.push(`RSI oversold: ${rsi.toFixed(2)}`);
                }
            }
        }
        
        // Additional confirmation from SMA
        const smaDistance = Math.abs(currentPrice - sma) / sma * 100;
        if (smaDistance > 5) { // 5% away from SMA
            if (signal === 'BUY' && currentPrice < sma) {
                strength += 10;
                reasons.push('Price significantly below SMA');
            } else if (signal === 'SELL' && currentPrice > sma) {
                strength += 10;
                reasons.push('Price significantly above SMA');
            }
        }
        
        // Volume confirmation
        const volume = data.marketData.volume || 0;
        if (volume > 0) {
            const history = this.priceHistory.get(data.symbol);
            const avgVolume = history.slice(-10).reduce((sum, h) => sum + (h.volume || 0), 0) / 10;
            
            if (volume > avgVolume * 1.5) {
                strength += 5;
                reasons.push('High volume confirmation');
            }
        }
        
        return {
            signal,
            strength: Math.max(0, Math.min(100, strength)),
            reason: reasons.length > 0 ? reasons.join('; ') : 'No mean reversion signals detected',
            data: {
                bollingerPosition: currentPrice > bollinger.upper ? 'above' : 
                                 currentPrice < bollinger.lower ? 'below' : 'within',
                rsi,
                smaDistance: smaDistance.toFixed(2)
            }
        };
    }
    
    /**
     * Calculate position size for mean reversion (typically smaller positions)
     */
    calculatePositionSize(symbol, price, accountValue) {
        // Mean reversion uses smaller position sizes due to higher risk
        const maxPositionValue = Math.min(
            this.config.riskManagement?.maxPositionSize || 5000,
            accountValue * 0.1 // Max 10% of account per position (conservative)
        );
        
        return Math.floor(maxPositionValue / price);
    }
    
    /**
     * Calculate exit levels for mean reversion
     */
    calculateExitLevels(signal, entryPrice) {
        // Mean reversion typically has tighter stops and targets
        const stopLossPercent = (this.config.riskManagement?.stopLossPercentage || 1.5) / 100;
        const takeProfitPercent = (this.config.riskManagement?.takeProfitPercentage || 3.0) / 100;
        
        if (signal === 'BUY') {
            return {
                stopLoss: entryPrice * (1 - stopLossPercent),
                takeProfit: entryPrice * (1 + takeProfitPercent)
            };
        } else if (signal === 'SELL') {
            return {
                stopLoss: entryPrice * (1 + stopLossPercent),
                takeProfit: entryPrice * (1 - takeProfitPercent)
            };
        }
        
        return { stopLoss: null, takeProfit: null };
    }
    
    /**
     * Check exit signals for mean reversion positions
     */
    checkExitSignal(symbol, position, marketData) {
        const currentPrice = marketData.lastPrice;
        
        // Standard stop loss/take profit checks
        const standardExit = this.checkStandardExits(position, currentPrice);
        if (standardExit.signal !== 'HOLD') {
            return standardExit;
        }
        
        // Mean reversion specific exits
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 20) {
            return { signal: 'HOLD', reason: 'Insufficient data for exit analysis' };
        }
        
        const prices = history.map(h => h.price);
        const bollinger = TechnicalIndicators.bollingerBands(prices, 20, 2);
        
        if (!bollinger) {
            return { signal: 'HOLD', reason: 'Unable to calculate exit indicators' };
        }
        
        // Exit when price returns to middle of Bollinger Bands (mean)
        const middleBandDistance = Math.abs(currentPrice - bollinger.middle) / bollinger.middle;
        
        if (middleBandDistance < 0.01) { // Within 1% of middle band
            const oppositeSide = position.side === 'BUY' ? 'SELL' : 'BUY';
            return {
                signal: oppositeSide,
                reason: 'Price returned to Bollinger Band middle (mean)',
                urgency: 'MEDIUM'
            };
        }
        
        return { signal: 'HOLD', reason: 'No mean reversion exit conditions met' };
    }
    
    /**
     * Check standard exit conditions
     */
    checkStandardExits(position, currentPrice) {
        // Stop loss
        if (position.side === 'BUY' && currentPrice <= position.stopLoss) {
            return { signal: 'SELL', reason: 'Stop loss triggered', urgency: 'HIGH' };
        } else if (position.side === 'SELL' && currentPrice >= position.stopLoss) {
            return { signal: 'BUY', reason: 'Stop loss triggered', urgency: 'HIGH' };
        }
        
        // Take profit
        if (position.side === 'BUY' && currentPrice >= position.takeProfit) {
            return { signal: 'SELL', reason: 'Take profit triggered', urgency: 'MEDIUM' };
        } else if (position.side === 'SELL' && currentPrice <= position.takeProfit) {
            return { signal: 'BUY', reason: 'Take profit triggered', urgency: 'MEDIUM' };
        }
        
        return { signal: 'HOLD', reason: 'No standard exit conditions met' };
    }
    
    /**
     * Get mean reversion specific performance metrics
     */
    getPerformanceMetrics() {
        const baseMetrics = super.getPerformanceMetrics();
        
        return {
            ...baseMetrics,
            strategyType: 'mean-reversion',
            bollingerPeriod: this.config.technicalIndicators?.bollinger?.period,
            meanReversionThreshold: this.config.meanReversion?.threshold,
            riskLevel: this.metadata.riskLevel
        };
    }
    
    /**
     * Mean reversion strategy health check
     */
    healthCheck() {
        const baseHealth = super.healthCheck();
        
        // Add mean reversion specific health checks
        let status = baseHealth.status;
        const issues = [...(baseHealth.issues || [])];
        
        // Check if Bollinger Bands can be calculated for tracked symbols
        let calculableIndicators = 0;
        const requiredPeriod = this.config.technicalIndicators?.bollinger?.period || 20;
        
        for (const [symbol, history] of this.priceHistory) {
            if (history.length >= requiredPeriod) {
                calculableIndicators++;
            }
        }
        
        if (this.priceHistory.size > 0 && calculableIndicators === 0) {
            status = 'warning';
            issues.push('Insufficient history for Bollinger Band calculation');
        }
        
        return {
            ...baseHealth,
            status,
            issues,
            calculableIndicators,
            requiredPeriod
        };
    }
}

// Export as default for dynamic loading
export default MeanReversionStrategy;
