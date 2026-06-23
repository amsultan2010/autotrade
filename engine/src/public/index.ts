/**
 * Stable public API for packages outside the engine (e.g. web).
 *
 * Web and other consumers MUST import from `@autotrade/engine/public` only.
 * Internal paths may change without notice during algorithm work.
 *
 * Worker and engine internals may continue using `@autotrade/engine`.
 */

// Configuration
export { env } from '../config/env';
export { DEFAULT_WATCHLIST } from '../config/defaults';
export { POPULAR_TICKERS, type PopularTicker } from '../config/popular';

// Errors
export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  PaymentRequiredError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from '../lib/errors';

// Validation
export { parse } from '../lib/validate';

// Audit
export { writeAudit } from '../lib/audit';


// Market data
export { getMarketData } from '../services/marketdata/index';
export { isStockMarketOpen } from '../lib/alpaca';

// Broker
export { loadUserBroker } from '../lib/broker-credentials';
export { AlpacaBroker } from '../services/execution/alpaca.broker';
export type { BrokerProvider } from '../services/execution/broker.types';

// Billing
export { createCheckoutSession, getStatus } from '../services/subscription.service';
export { getStripe, isStripeConfigured, isBillingEnabled } from '../lib/stripe';

// Bot cycle (cron / internal routes)
export { runCycleForUser } from '../workers/scanLoop';

// Strategy catalog (settings UI)
export {
  getGroupedCatalog,
  getStrategyCatalog,
  type StrategyCatalogEntry,
} from '../services/strategy-engine/catalog';
export { runStrategyEngine } from '../services/strategy-engine';

// Live quote streaming
export { liveEngine } from '../workers/liveEngine';
