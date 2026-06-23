import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../middleware/auth.js';
import { UnauthorizedError } from '../../lib/errors.js';
import * as subService from './subscription.service.js';
import { isStripeConfigured } from '../../lib/stripe.js';

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // Current entitlement — the desktop app calls this after login.
  app.get('/subscription/status', { preHandler: [authGuard] }, async (req) => {
    const user = req.authUser;
    if (!user) throw new UnauthorizedError();
    return subService.getStatus(user.id, user.role);
  });

  // Start checkout for the single paid tier.
  app.post('/subscription/checkout', { preHandler: [authGuard] }, async (req) => {
    const user = req.authUser;
    if (!user) throw new UnauthorizedError();
    return subService.createCheckoutSession(user.id, user.email);
  });

  app.get('/subscription/config', async () => ({ configured: isStripeConfigured() }));

  // Stripe webhook — NO auth (Stripe calls it). Verified by signature instead.
  // Uses the raw request body captured by the content-type parser in app.ts.
  app.post('/subscription/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    await subService.handleWebhook(
      req.rawBody ?? Buffer.from(''),
      Array.isArray(sig) ? sig[0] : sig,
    );
    return reply.send({ received: true });
  });
}
