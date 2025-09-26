/**
 * Interactive Brokers Client Portal SDK for Node.js
 * 
 * A comprehensive SDK for connecting to Interactive Brokers Client Portal API
 * for paper trading and market data retrieval.
 */

// Import all classes and functions first
import { IBClient } from './client.js';
import { MarketDataClient } from './market-data.js';
import { HistoricalDataClient } from "./historical-data.js";
import { WatchlistManager } from "./watchlist-manager.js";
import { OrderClient, OrderTypes, OrderSides, TimeInForce } from "./orders.js";
import { Config } from "./config.js";
import {
  IBSDKError,
  AuthenticationError,
  RateLimitError,
  APIError,
  ConnectionError,
  InvalidSymbolError,
} from "./exceptions.js";

// Re-export all imports
export { IBClient } from "./client.js";
export { MarketDataClient } from "./market-data.js";
export { HistoricalDataClient } from "./historical-data.js";
export { WatchlistManager } from "./watchlist-manager.js";
export { OrderClient, OrderTypes, OrderSides, TimeInForce } from "./orders.js";
export { Config } from "./config.js";
export {
  IBSDKError,
  AuthenticationError,
  RateLimitError,
  APIError,
  ConnectionError,
  InvalidSymbolError,
} from "./exceptions.js";

// Version information
export const VERSION = "1.0.0";
export const AUTHOR = "IB SDK";

/**
 * Create a new IB Client with default configuration
 *
 * @param {Object} [options] - Configuration options
 * @returns {IBClient} Configured IB Client instance
 */
export function createClient(options = {}) {
  const config = new Config(options);
  return new IBClient(config);
}

/**
 * Create a new Market Data Client with default configuration
 *
 * @param {Object} [options] - Configuration options
 * @returns {MarketDataClient} Configured Market Data Client instance
 */
export function createMarketDataClient(options = {}) {
  const config = new Config(options);
  const ibClient = new IBClient(config);
  return new MarketDataClient(ibClient, config);
}

/**
 * Create a new Historical Data Client with default configuration
 *
 * @param {Object} [options] - Configuration options
 * @returns {HistoricalDataClient} Configured Historical Data Client instance
 */
export function createHistoricalDataClient(options = {}) {
  const config = new Config(options);
  const ibClient = new IBClient(config);
  return new HistoricalDataClient(ibClient);
}

/**
 * Create a new Order Client with default configuration
 *
 * @param {Object} [options] - Configuration options
 * @returns {OrderClient} Configured Order Client instance
 */
export function createOrderClient(options = {}) {
  const config = new Config(options);
  const ibClient = new IBClient(config);
  return new OrderClient(ibClient, config);
}

// Default export for convenience
export default {
  IBClient,
  MarketDataClient,
  HistoricalDataClient,
  WatchlistManager,
  OrderClient,
  Config,
  createClient,
  createMarketDataClient,
  createHistoricalDataClient,
  createOrderClient,
  OrderTypes,
  OrderSides,
  TimeInForce,
  VERSION,
  AUTHOR,
};
