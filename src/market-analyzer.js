/**
 * Market Condition Analyzer
 * 
 * Analyzes current market conditions to determine the optimal trading strategy.
 * Uses multiple indicators to classify market regime and recommend strategies.
 */

import { logger } from './logger.js';

export class MarketAnalyzer {
    constructor(marketDataClient) {
        this.marketDataClient = marketDataClient;
        this.marketIndices = ['SPY', 'QQQ', 'IWM', 'VIX']; // Market indicators
        this.analysisHistory = [];
        this.currentRegime = null;
        this.regimeConfidence = 0;
    }

    /**
     * Analyze current market conditions and determine regime
     * @returns {Object} Market analysis with regime and confidence
     */
    async analyzeMarketConditions() {
        try {
            logger.info('🔍 Analyzing market conditions...');

            const marketData = await this.gatherMarketData();
            const volatilityAnalysis = this.analyzeVolatility(marketData);
            const trendAnalysis = this.analyzeTrend(marketData);
            const momentumAnalysis = this.analyzeMomentum(marketData);
            const breadthAnalysis = this.analyzeBreadth(marketData);

            const regime = this.determineMarketRegime({
                volatility: volatilityAnalysis,
                trend: trendAnalysis,
                momentum: momentumAnalysis,
                breadth: breadthAnalysis
            });

            const analysis = {
                timestamp: Date.now(),
                regime: regime.type,
                confidence: regime.confidence,
                indicators: {
                    volatility: volatilityAnalysis,
                    trend: trendAnalysis,
                    momentum: momentumAnalysis,
                    breadth: breadthAnalysis
                },
                recommendedStrategies: this.getRecommendedStrategies(regime.type),
                marketData: marketData
            };

            this.analysisHistory.push(analysis);
            this.currentRegime = regime.type;
            this.regimeConfidence = regime.confidence;

            // Keep only last 50 analyses
            if (this.analysisHistory.length > 50) {
                this.analysisHistory = this.analysisHistory.slice(-50);
            }

            logger.info(`📊 Market regime: ${regime.type} (confidence: ${regime.confidence.toFixed(2)})`);
            return analysis;

        } catch (error) {
            logger.error('❌ Error analyzing market conditions:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Gather market data from key indices
     */
    async gatherMarketData() {
        const marketData = {};

        for (const symbol of this.marketIndices) {
            try {
                // Get current quote
                const quote = await this.marketDataClient.getQuote(symbol);
                if (quote && quote.length > 0) {
                    const data = quote[0];
                    marketData[symbol] = {
                        price: data.last || data.bid || data.ask,
                        change: data.change || 0,
                        changePercent: data.changePercent || 0,
                        volume: data.volume || 0,
                        bid: data.bid,
                        ask: data.ask,
                        high: data.high,
                        low: data.low
                    };
                }

                // Rate limiting
                await this.sleep(1000);
            } catch (error) {
                logger.warn(`⚠️ Failed to get data for ${symbol}:`, error.message);
                marketData[symbol] = this.getDefaultQuoteData();
            }
        }

        return marketData;
    }

    /**
     * Analyze market volatility
     */
    analyzeVolatility(marketData) {
        const vix = marketData.VIX;
        const spyChange = Math.abs(marketData.SPY?.changePercent || 0);
        const qqq = Math.abs(marketData.QQQ?.changePercent || 0);

        let volatilityLevel = 'LOW';
        let volatilityScore = 0;

        if (vix?.price) {
            if (vix.price > 30) {
                volatilityLevel = 'HIGH';
                volatilityScore = 0.8;
            } else if (vix.price > 20) {
                volatilityLevel = 'MEDIUM';
                volatilityScore = 0.5;
            } else {
                volatilityLevel = 'LOW';
                volatilityScore = 0.2;
            }
        }

        // Adjust based on daily moves
        const avgDailyMove = (spyChange + qqq) / 2;
        if (avgDailyMove > 2) {
            volatilityScore += 0.3;
            if (volatilityLevel === 'LOW') volatilityLevel = 'MEDIUM';
        } else if (avgDailyMove > 1) {
            volatilityScore += 0.1;
        }

        return {
            level: volatilityLevel,
            score: Math.min(volatilityScore, 1.0),
            vixLevel: vix?.price || 20,
            avgDailyMove: avgDailyMove
        };
    }

    /**
     * Analyze market trend
     */
    analyzeTrend(marketData) {
        const spyChange = marketData.SPY?.changePercent || 0;
        const qqqChange = marketData.QQQ?.changePercent || 0;
        const iwmChange = marketData.IWM?.changePercent || 0;

        const avgChange = (spyChange + qqqChange + iwmChange) / 3;
        
        let trendDirection = 'NEUTRAL';
        let trendStrength = 0;

        if (avgChange > 1) {
            trendDirection = 'BULLISH';
            trendStrength = Math.min(avgChange / 2, 1.0);
        } else if (avgChange < -1) {
            trendDirection = 'BEARISH';
            trendStrength = Math.min(Math.abs(avgChange) / 2, 1.0);
        } else {
            trendDirection = 'NEUTRAL';
            trendStrength = 0.3;
        }

        return {
            direction: trendDirection,
            strength: trendStrength,
            avgChange: avgChange,
            consistency: this.calculateTrendConsistency([spyChange, qqqChange, iwmChange])
        };
    }

    /**
     * Analyze market momentum
     */
    analyzeMomentum(marketData) {
        const spy = marketData.SPY || {};
        const qqq = marketData.QQQ || {};

        // Simple momentum based on price action and volume
        const priceMovement = (spy.changePercent || 0 + qqq.changePercent || 0) / 2;
        const volumeIndicator = (spy.volume || 0) > 0 ? 1 : 0.5; // Simplified volume check

        let momentumType = 'NEUTRAL';
        let momentumScore = 0.5;

        if (priceMovement > 0.5) {
            momentumType = 'POSITIVE';
            momentumScore = Math.min(0.5 + priceMovement / 4, 1.0);
        } else if (priceMovement < -0.5) {
            momentumType = 'NEGATIVE';
            momentumScore = Math.max(0.5 - Math.abs(priceMovement) / 4, 0);
        }

        return {
            type: momentumType,
            score: momentumScore,
            priceMovement: priceMovement,
            volumeIndicator: volumeIndicator
        };
    }

    /**
     * Analyze market breadth
     */
    analyzeBreadth(marketData) {
        const spy = marketData.SPY?.changePercent || 0;
        const qqq = marketData.QQQ?.changePercent || 0;
        const iwm = marketData.IWM?.changePercent || 0;

        // Count how many indices are positive
        const positiveCount = [spy, qqq, iwm].filter(change => change > 0).length;
        const breadthRatio = positiveCount / 3;

        let breadthType = 'MIXED';
        if (breadthRatio >= 0.67) breadthType = 'BROAD_POSITIVE';
        else if (breadthRatio <= 0.33) breadthType = 'BROAD_NEGATIVE';

        return {
            type: breadthType,
            ratio: breadthRatio,
            positiveCount: positiveCount,
            totalCount: 3
        };
    }

    /**
     * Determine market regime based on all indicators
     */
    determineMarketRegime(indicators) {
        const { volatility, trend, momentum, breadth } = indicators;

        // Define regime scoring
        let regimeScores = {
            'TRENDING_BULL': 0,
            'TRENDING_BEAR': 0,
            'VOLATILE_SIDEWAYS': 0,
            'LOW_VOL_GRIND': 0,
            'CRISIS_MODE': 0
        };

        // Trending Bull Market
        if (trend.direction === 'BULLISH' && volatility.level === 'LOW') {
            regimeScores['TRENDING_BULL'] += 0.4;
        }
        if (momentum.type === 'POSITIVE') {
            regimeScores['TRENDING_BULL'] += 0.3;
        }
        if (breadth.type === 'BROAD_POSITIVE') {
            regimeScores['TRENDING_BULL'] += 0.3;
        }

        // Trending Bear Market
        if (trend.direction === 'BEARISH' && volatility.level !== 'HIGH') {
            regimeScores['TRENDING_BEAR'] += 0.4;
        }
        if (momentum.type === 'NEGATIVE') {
            regimeScores['TRENDING_BEAR'] += 0.3;
        }
        if (breadth.type === 'BROAD_NEGATIVE') {
            regimeScores['TRENDING_BEAR'] += 0.3;
        }

        // Volatile Sideways
        if (volatility.level === 'MEDIUM' && trend.direction === 'NEUTRAL') {
            regimeScores['VOLATILE_SIDEWAYS'] += 0.5;
        }
        if (breadth.type === 'MIXED') {
            regimeScores['VOLATILE_SIDEWAYS'] += 0.3;
        }

        // Low Volatility Grind
        if (volatility.level === 'LOW' && trend.strength < 0.3) {
            regimeScores['LOW_VOL_GRIND'] += 0.6;
        }

        // Crisis Mode
        if (volatility.level === 'HIGH') {
            regimeScores['CRISIS_MODE'] += 0.6;
        }
        if (trend.direction === 'BEARISH' && volatility.score > 0.7) {
            regimeScores['CRISIS_MODE'] += 0.4;
        }

        // Find the regime with highest score
        const bestRegime = Object.entries(regimeScores).reduce((a, b) => 
            regimeScores[a[0]] > regimeScores[b[0]] ? a : b
        );

        return {
            type: bestRegime[0],
            confidence: bestRegime[1],
            allScores: regimeScores
        };
    }

    /**
     * Get recommended strategies for each market regime
     */
    getRecommendedStrategies(regime) {
        const strategyMap = {
            'TRENDING_BULL': [
                { name: 'momentum', priority: 1, allocation: 0.5 },
                { name: 'wyckoff-v2', priority: 2, allocation: 0.3 },
                { name: 'elder-triple-screen', priority: 3, allocation: 0.2 }
            ],
            'TRENDING_BEAR': [
                { name: 'mean-reversion', priority: 1, allocation: 0.4 },
                { name: 'rsi2-mean-reversion', priority: 2, allocation: 0.3 },
                { name: 'random-walk-passive', priority: 3, allocation: 0.3 }
            ],
            'VOLATILE_SIDEWAYS': [
                { name: 'mean-reversion', priority: 1, allocation: 0.4 },
                { name: 'rsi2-mean-reversion', priority: 2, allocation: 0.4 },
                { name: 'force-index', priority: 3, allocation: 0.2 }
            ],
            'LOW_VOL_GRIND': [
                { name: 'momentum', priority: 1, allocation: 0.4 },
                { name: 'donchian-breakout', priority: 2, allocation: 0.3 },
                { name: 'voltarget-trend', priority: 3, allocation: 0.3 }
            ],
            'CRISIS_MODE': [
                { name: 'random-walk-passive', priority: 1, allocation: 0.6 },
                { name: 'graham-defensive', priority: 2, allocation: 0.4 }
            ]
        };

        return strategyMap[regime] || strategyMap['VOLATILE_SIDEWAYS'];
    }

    /**
     * Helper methods
     */
    calculateTrendConsistency(changes) {
        const positives = changes.filter(c => c > 0).length;
        const negatives = changes.filter(c => c < 0).length;
        return Math.max(positives, negatives) / changes.length;
    }

    getDefaultQuoteData() {
        return {
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            bid: 0,
            ask: 0,
            high: 0,
            low: 0
        };
    }

    getDefaultAnalysis() {
        return {
            timestamp: Date.now(),
            regime: 'VOLATILE_SIDEWAYS',
            confidence: 0.3,
            indicators: {
                volatility: { level: 'MEDIUM', score: 0.5 },
                trend: { direction: 'NEUTRAL', strength: 0.3 },
                momentum: { type: 'NEUTRAL', score: 0.5 },
                breadth: { type: 'MIXED', ratio: 0.5 }
            },
            recommendedStrategies: this.getRecommendedStrategies('VOLATILE_SIDEWAYS'),
            marketData: {}
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current market regime
     */
    getCurrentRegime() {
        return {
            regime: this.currentRegime,
            confidence: this.regimeConfidence,
            lastUpdate: this.analysisHistory.length > 0 ? 
                this.analysisHistory[this.analysisHistory.length - 1].timestamp : null
        };
    }

    /**
     * Get analysis history
     */
    getAnalysisHistory(limit = 10) {
        return this.analysisHistory.slice(-limit);
    }
}
