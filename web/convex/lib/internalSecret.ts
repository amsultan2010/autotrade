/** Guard server-to-server Convex calls (Stripe webhooks, engine billing). */
export function requireInternalSecret(secret: string): void {
  const expected = process.env.BOT_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized');
  }
}
