import 'dotenv/config';
import { startScanLoop, liveEngine, env } from '@autotrade/engine';

async function main() {
  console.log('🤖 Autotrade worker starting…');
  if (env.ALPACA_STREAMING) {
    await liveEngine.start();
    console.log('✅ Live engine streaming started');
  }
  startScanLoop(60_000);
  console.log('✅ Scan loop running (60s interval)');

  const shutdown = async () => {
    console.log('Shutting down…');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
