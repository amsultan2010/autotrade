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

// Database (web API routes — migrate to Convex over time)
export { prisma } from '../lib/prisma';

// Audit
export { writeAudit } from '../lib/audit';

// Secrets
export { encryptSecret } from '../lib/crypto';

// Market data
export { getMarketData } from '../services/marketdata/index';
export { isStockMarketOpen } from '../lib/alpaca';

// Broker
export { loadUserBroker } from '../lib/broker-credentials';

// Billing
export { createCheckoutSession } from '../services/subscription.service';

// Bot cycle (cron / internal routes)
export { runCycleForUser } from '../workers/scanLoop';

// Live quote streaming
export { liveEngine } from '../workers/liveEngine';
