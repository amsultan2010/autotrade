/** Fastify application factory: plugins, security, error handling, routes. */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { ErrorCodes, generateErrorRefId } from '@autotrade/shared';
import { env, isDev } from './config/env.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { subscriptionRoutes } from './modules/subscription/subscription.routes.js';
import { watchlistRoutes } from './modules/watchlist/watchlist.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { tradesRoutes } from './modules/trades/trades.routes.js';
import { botRoutes } from './modules/bot/bot.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { brokerRoutes } from './modules/broker/broker.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty' }, level: 'debug' }
      : { level: 'info' },
    trustProxy: true,
    // Stripe webhook needs the raw body; capture it for that route only.
    bodyLimit: 1_048_576,
  });

  await app.register(helmet, { contentSecurityPolicy: isDev ? false : undefined });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Keep JSON parsing everywhere, but also retain the raw bytes so the Stripe
  // webhook route can verify signatures against the exact payload.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      const buf = body as Buffer;
      (_req as { rawBody?: Buffer }).rawBody = buf;
      if (buf.length === 0) return done(null, undefined);
      try {
        done(null, JSON.parse(buf.toString('utf8')));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // ── Global error handler: typed AppError → HTTP; never leak internals ──
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: ErrorCodes.VALIDATION_FAILED, message: 'Validation failed', details: err.flatten() },
      });
    }
    // Fastify's built-in rate-limit error
    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: { code: ErrorCodes.RATE_LIMITED, message: 'Too many requests' } });
    }
    const refId = generateErrorRefId();
    req.log.error({ err, refId }, 'Unhandled error');
    return reply.code(500).send({
      error: { code: ErrorCodes.INTERNAL, message: 'Something went wrong', refId },
    });
  });

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // ── Feature routes ──
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(subscriptionRoutes, { prefix: '/api/v1' });
  await app.register(watchlistRoutes, { prefix: '/api/v1' });
  await app.register(settingsRoutes, { prefix: '/api/v1' });
  await app.register(tradesRoutes, { prefix: '/api/v1' });
  await app.register(botRoutes, { prefix: '/api/v1' });
  await app.register(adminRoutes, { prefix: '/api/v1' });
  await app.register(brokerRoutes, { prefix: '/api/v1' });

  return app;
}
