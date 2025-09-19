/**
 * Momentum Trading Strategy Implementation
 */

import { TechnicalIndicators } from './technical-indicators.js';
import { TradingLogger } from './logger.js';
import { BaseStrategy } from "./base-strategy.js";

export class MomentumStrategy extends BaseStrategy {
  constructor(config) {
    super("momentum", config);

    // Strategy-specific metadata
    this.metadata = {
      version: "1.0.0",
      author: "IB SDK Team",
      description: "Momentum-based trading strategy using technical indicators",
      timeframe: "5m",
      riskLevel: "medium",
      requiredIndicators: ["RSI", "SMA", "Bollinger Bands", "Volume"],
      minHistoryRequired: 30,
    };
  }

  /**
   * Initialize the momentum strategy
   */
  async initialize() {
    try {
      // Validate required configuration
      this.validateMomentumConfig();

      TradingLogger.logStrategy("Momentum strategy initialized", {
        lookbackDays: this.config.momentum?.lookbackDays,
        threshold: this.config.momentum?.thresholdPercentage,
        rsiPeriod: this.config.technicalIndicators?.rsi?.period,
      });

      return true;
    } catch (error) {
      TradingLogger.logError(error, "Momentum strategy initialization");
      return false;
    }
  }

  /**
   * Validate momentum-specific configuration
   */
  validateMomentumConfig() {
    super.validateConfig();

    if (!this.config.momentum) {
      throw new Error("Momentum configuration is required");
    }

    if (!this.config.technicalIndicators) {
      throw new Error("Technical indicators configuration is required");
    }

    const required = ["lookbackDays", "thresholdPercentage", "volumeThreshold"];
    for (const field of required) {
      if (this.config.momentum[field] === undefined) {
        throw new Error(`Momentum configuration missing: ${field}`);
      }
    }
  }

  /**
   * Get maximum history length required by momentum strategy
   */
  getMaxHistoryLength() {
    const lookbackDays = this.config.momentum?.lookbackDays || 20;
    const rsiPeriod = this.config.technicalIndicators?.rsi?.period || 14;
    const bollinger = this.config.technicalIndicators?.bollinger?.period || 20;

    return Math.max(lookbackDays * 24, rsiPeriod + 10, bollinger + 10);
  }

  // Note: updatePriceHistory is now handled by BaseStrategy

  /**
   * Analyze a symbol for trading signals
   * @param {string} symbol - Stock symbol
   * @param {Object} marketData - Current market data
   * @returns {Object} Analysis result with signal and strength
   */
  analyze(symbol, marketData) {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < this.config.momentum.lookbackDays) {
      return { signal: "HOLD", strength: 0, reason: "Insufficient data" };
    }

    const prices = history.map((h) => h.price);
    const volumes = history.map((h) => h.volume);
    const currentPrice = marketData.lastPrice;
    const currentVolume = marketData.volume;

    // Calculate technical indicators
    const momentum = TechnicalIndicators.momentum(
      prices,
      this.config.momentum.lookbackDays
    );
    const rsi = TechnicalIndicators.rsi(
      prices,
      this.config.technicalIndicators.rsi.period
    );
    const smaShort = TechnicalIndicators.sma(
      prices,
      this.config.technicalIndicators.movingAverages.short
    );
    const smaLong = TechnicalIndicators.sma(
      prices,
      this.config.technicalIndicators.movingAverages.long
    );
    const bollinger = TechnicalIndicators.bollingerBands(
      prices,
      this.config.technicalIndicators.bollinger.period
    );

    // Volume analysis
    const avgVolume =
      volumes.slice(-10).reduce((sum, vol) => sum + vol, 0) / 10;
    const volumeRatio = currentVolume / avgVolume;

    // Generate signals
    const signals = this.generateSignals({
      symbol,
      currentPrice,
      momentum,
      rsi,
      smaShort,
      smaLong,
      bollinger,
      volumeRatio,
      avgVolume,
    });

    TradingLogger.logSignal(`Analysis for ${symbol}`, symbol, {
      momentum: momentum?.toFixed(2),
      rsi: rsi?.toFixed(2),
      volumeRatio: volumeRatio?.toFixed(2),
      signal: signals.signal,
    });

    return signals;
  }

  /**
   * Generate trading signals based on technical analysis
   * @param {Object} data - Analysis data
   * @returns {Object} Signal with strength and reason
   */
  generateSignals(data) {
    const {
      symbol,
      currentPrice,
      momentum,
      rsi,
      smaShort,
      smaLong,
      bollinger,
      volumeRatio,
      avgVolume,
    } = data;

    let signal = "HOLD";
    let strength = 0;
    let reasons = [];

    // Momentum-based signals
    if (momentum > this.config.momentum.thresholdPercentage) {
      signal = "BUY";
      strength += 30;
      reasons.push(`Strong upward momentum: ${momentum.toFixed(2)}%`);
    } else if (momentum < -this.config.momentum.thresholdPercentage) {
      signal = "SELL";
      strength += 30;
      reasons.push(`Strong downward momentum: ${momentum.toFixed(2)}%`);
    }

    // RSI signals
    if (
      rsi < this.config.technicalIndicators.rsi.oversold &&
      signal !== "SELL"
    ) {
      if (signal === "HOLD") signal = "BUY";
      strength += 20;
      reasons.push(`RSI oversold: ${rsi.toFixed(2)}`);
    } else if (
      rsi > this.config.technicalIndicators.rsi.overbought &&
      signal !== "BUY"
    ) {
      if (signal === "HOLD") signal = "SELL";
      strength += 20;
      reasons.push(`RSI overbought: ${rsi.toFixed(2)}`);
    }

    // Moving average crossover
    if (smaShort && smaLong) {
      if (smaShort > smaLong && currentPrice > smaShort) {
        if (signal === "HOLD") signal = "BUY";
        if (signal === "BUY") strength += 15;
        reasons.push("Price above short MA, short MA above long MA");
      } else if (smaShort < smaLong && currentPrice < smaShort) {
        if (signal === "HOLD") signal = "SELL";
        if (signal === "SELL") strength += 15;
        reasons.push("Price below short MA, short MA below long MA");
      }
    }

    // Bollinger Bands
    if (bollinger) {
      if (currentPrice < bollinger.lower && signal !== "SELL") {
        if (signal === "HOLD") signal = "BUY";
        strength += 10;
        reasons.push("Price below lower Bollinger Band");
      } else if (currentPrice > bollinger.upper && signal !== "BUY") {
        if (signal === "HOLD") signal = "SELL";
        strength += 10;
        reasons.push("Price above upper Bollinger Band");
      }
    }

    // Volume confirmation
    if (volumeRatio > 1.5) {
      strength += 10;
      reasons.push(
        `High volume confirmation: ${volumeRatio.toFixed(2)}x average`
      );
    } else if (volumeRatio < 0.5) {
      strength -= 10;
      reasons.push(`Low volume warning: ${volumeRatio.toFixed(2)}x average`);
    }

    // Volume threshold check
    if (avgVolume < this.config.momentum.volumeThreshold) {
      signal = "HOLD";
      strength = 0;
      reasons = ["Insufficient average volume"];
    }

    // Price range check
    if (
      currentPrice < this.config.momentum.priceRange.min ||
      currentPrice > this.config.momentum.priceRange.max
    ) {
      signal = "HOLD";
      strength = 0;
      reasons = ["Price outside acceptable range"];
    }

    return {
      signal,
      strength: Math.max(0, Math.min(100, strength)),
      reason: reasons.join("; "),
      data: {
        momentum,
        rsi,
        volumeRatio,
        currentPrice,
      },
    };
  }

  /**
   * Calculate position size based on risk management rules
   * @param {string} symbol - Stock symbol
   * @param {number} price - Entry price
   * @param {number} accountValue - Current account value
   * @returns {number} Position size in shares
   */
  calculatePositionSize(symbol, price, accountValue) {
    const maxPositionValue = Math.min(
      this.config.riskManagement.maxPositionSize,
      accountValue * 0.2 // Max 20% of account per position
    );

    const baseShares = Math.floor(maxPositionValue / price);

    // Adjust based on volatility (simplified)
    const history = this.priceHistory.get(symbol);
    if (history && history.length > 10) {
      const prices = history.slice(-10).map((h) => h.price);
      const volatility = this.calculateVolatility(prices);

      // Reduce position size for high volatility stocks
      const volatilityAdjustment = Math.max(0.5, 1 - volatility / 100);
      return Math.floor(baseShares * volatilityAdjustment);
    }

    return baseShares;
  }

  /**
   * Calculate price volatility
   * @param {Array<number>} prices - Price array
   * @returns {number} Volatility percentage
   */
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
      returns.length;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
  }

  /**
   * Calculate stop loss and take profit levels
   * @param {string} signal - BUY or SELL
   * @param {number} entryPrice - Entry price
   * @returns {Object} Stop loss and take profit prices
   */
  calculateExitLevels(signal, entryPrice) {
    const stopLossPercent = this.config.riskManagement.stopLossPercentage / 100;
    const takeProfitPercent =
      this.config.riskManagement.takeProfitPercentage / 100;

    if (signal === "BUY") {
      return {
        stopLoss: entryPrice * (1 - stopLossPercent),
        takeProfit: entryPrice * (1 + takeProfitPercent),
      };
    } else if (signal === "SELL") {
      return {
        stopLoss: entryPrice * (1 + stopLossPercent),
        takeProfit: entryPrice * (1 - takeProfitPercent),
      };
    }

    return { stopLoss: null, takeProfit: null };
  }

  /**
   * Check if we should exit an existing position
   * @param {string} symbol - Stock symbol
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @returns {Object} Exit signal
   */
  checkExitSignal(symbol, position, marketData) {
    const currentPrice = marketData.lastPrice;
    const entryPrice = position.entryPrice;
    const side = position.side;

    // Stop loss check
    if (side === "BUY" && currentPrice <= position.stopLoss) {
      return {
        signal: "SELL",
        reason: "Stop loss triggered",
        urgency: "HIGH",
      };
    } else if (side === "SELL" && currentPrice >= position.stopLoss) {
      return {
        signal: "BUY",
        reason: "Stop loss triggered",
        urgency: "HIGH",
      };
    }

    // Take profit check
    if (side === "BUY" && currentPrice >= position.takeProfit) {
      return {
        signal: "SELL",
        reason: "Take profit triggered",
        urgency: "MEDIUM",
      };
    } else if (side === "SELL" && currentPrice <= position.takeProfit) {
      return {
        signal: "BUY",
        reason: "Take profit triggered",
        urgency: "MEDIUM",
      };
    }

    // Trailing stop check (simplified)
    const trailingPercent =
      this.config.riskManagement.trailingStopPercentage / 100;
    if (side === "BUY") {
      const trailingStop = currentPrice * (1 - trailingPercent);
      if (trailingStop > position.stopLoss) {
        position.stopLoss = trailingStop;
        TradingLogger.logPosition("Updated trailing stop", symbol, {
          newStopLoss: trailingStop,
        });
      }
    }

    return { signal: "HOLD", reason: "No exit conditions met" };
  }

  /**
   * Get momentum-specific performance metrics
   */
  getPerformanceMetrics() {
    const baseMetrics = super.getPerformanceMetrics();

    return {
      ...baseMetrics,
      strategyType: "momentum",
      lookbackPeriod: this.config.momentum?.lookbackDays,
      momentumThreshold: this.config.momentum?.thresholdPercentage,
      rsiPeriod: this.config.technicalIndicators?.rsi?.period,
    };
  }

  /**
   * Momentum strategy health check
   */
  healthCheck() {
    const baseHealth = super.healthCheck();

    // Add momentum-specific health checks
    const historyCount = this.priceHistory.size;
    const requiredHistory = this.getMaxHistoryLength();

    let status = "healthy";
    const issues = [];

    if (historyCount === 0) {
      status = "warning";
      issues.push("No price history available");
    }

    // Check if we have sufficient history for any symbols
    let sufficientHistoryCount = 0;
    for (const [symbol, history] of this.priceHistory) {
      if (history.length >= this.config.momentum?.lookbackDays) {
        sufficientHistoryCount++;
      }
    }

    if (historyCount > 0 && sufficientHistoryCount === 0) {
      status = "warning";
      issues.push("Insufficient price history for analysis");
    }

    return {
      ...baseHealth,
      status,
      issues,
      historyCount,
      sufficientHistoryCount,
      requiredHistoryLength: requiredHistory,
    };
  }

  /**
   * Cleanup momentum strategy resources
   */
  async cleanup() {
    TradingLogger.logStrategy("Cleaning up momentum strategy");
    await super.cleanup();
    return true;
  }
}
