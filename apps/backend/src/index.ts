/** Server entrypoint. */
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { startScanLoop, stopScanLoop } from './workers/scanLoop.js';
import { liveEngine } from './workers/liveEngine.js';
import { isMarketDataConfigured } from './services/marketdata/index.js';
import { isStreamingConfigured, streamingProviderName } from './services/marketdata/streaming.js';
import { startEmbeddedPostgres, stopEmbeddedPostgres } from './lib/embeddedDb.js';

async function main(): Promise<void> {
  // Packaged app: start our own database before anything touches Prisma.
  if (env.EMBEDDED_DB) {
    await startEmbeddedPostgres();
  }

  const app = await buildApp();

  // Safety net: a stray rejection (e.g. a background worker) must not crash the
  // API process. Log it; keep serving. (uncaughtException is intentionally NOT
  // swallowed — those indicate truly broken state.)
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'Unhandled promise rejection (suppressed)');
  });

  // Pick the bot driver. Real-time streaming needs BOTH a live feed (stream)
  // and a candle source (REST). Otherwise fall back to polling, or warn.
  if (isStreamingConfigured() && isMarketDataConfigured()) {
    app.log.info(`Real-time mode: ${streamingProviderName()} stream + ${env.MARKET_DATA_PROVIDER} candles`);
    await liveEngine.start();
  } else if (isMarketDataConfigured()) {
    if (isStreamingConfigured()) app.log.warn('Streaming wants a REST candle source too — using polling.');
    startScanLoop(60_000);
  } else {
    app.log.warn(
      `No usable market data. Add a candle key (e.g. TWELVEDATA_API_KEY) and/or a ` +
        `real-time key (FINNHUB_API_KEY or Alpaca keys) to apps/backend/.env.`,
    );
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down…`);
    stopScanLoop();
    liveEngine.stop();
    await app.close();
    await disconnectPrisma();
    if (env.EMBEDDED_DB) await stopEmbeddedPostgres();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
