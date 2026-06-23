/**
 * Crypto Strategy Engine — public surface.
 *
 * Modular crypto layer that plugs into the SHARED selector, so the bot compares
 * legacy + stock + crypto strategies in one place. Crypto strategies self-gate
 * to crypto assets; crypto regimes are detected for crypto symbols.
 */
export * from './regimes';
export * from './risk';
export * from './config';
export * from './registry';
