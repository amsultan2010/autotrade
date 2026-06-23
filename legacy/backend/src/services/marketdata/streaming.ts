/**
 * Streaming-provider factory. Selects a real-time feed independently of the
 * REST candle provider, so you can mix (e.g. Finnhub live ticks + Twelve Data
 * candles, or Alpaca for both).
 */
import { env } from '../../config/env.js';
import { isAlpacaConfigured } from '../../lib/alpaca.js';
import { AlpacaStream } from './alpaca.stream.js';
import { FinnhubStream } from './finnhub.stream.js';
import type { StreamingProvider } from './streaming.types.js';

function resolve(): 'alpaca' | 'finnhub' | null {
  switch (env.STREAM_PROVIDER) {
    case 'none':
      return null;
    case 'alpaca':
      return isAlpacaConfigured() ? 'alpaca' : null;
    case 'finnhub':
      return env.FINNHUB_API_KEY ? 'finnhub' : null;
    case 'auto':
    default:
      if (isAlpacaConfigured()) return 'alpaca';
      if (env.FINNHUB_API_KEY) return 'finnhub';
      return null;
  }
}

export function isStreamingConfigured(): boolean {
  return resolve() !== null;
}

export function streamingProviderName(): string | null {
  return resolve();
}

export function getStreamingProvider(): StreamingProvider | null {
  const choice = resolve();
  if (choice === 'alpaca') return new AlpacaStream();
  if (choice === 'finnhub') return new FinnhubStream();
  return null;
}
