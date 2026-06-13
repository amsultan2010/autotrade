import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate.js';
import { authGuard } from '../../middleware/auth.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Tighter rate limit on auth endpoints to slow credential stuffing.
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/register', authLimit, async (req, reply) => {
    const { email, password } = parse(registerSchema, req.body);
    const { user, tokens } = await authService.register(email, password);
    return reply.code(201).send({ user, ...tokens });
  });

  app.post('/auth/login', authLimit, async (req, reply) => {
    const { email, password } = parse(loginSchema, req.body);
    const { user, tokens } = await authService.login(email, password);
    return reply.send({ user, ...tokens });
  });

  app.post('/auth/refresh', authLimit, async (req, reply) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    const tokens = await authService.refresh(refreshToken);
    return reply.send(tokens);
  });

  app.post('/auth/logout', async (req, reply) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await authService.logout(refreshToken);
    return reply.code(204).send();
  });

  // Who am I — used by the desktop app on launch.
  app.get('/auth/me', { preHandler: [authGuard] }, async (req) => {
    return { user: req.authUser };
  });

  // Clerk session token → backend JWT (used after Clerk signs the user in).
  app.post('/auth/clerk-sync', authLimit, async (req, reply) => {
    const body = req.body as { sessionToken?: string };
    if (!body?.sessionToken) {
      return reply.code(400).send({ error: { code: 'MISSING_TOKEN', message: 'sessionToken is required' } });
    }
    const { user, tokens } = await authService.clerkSync(body.sessionToken);
    return reply.send({ user, ...tokens });
  });
}
