import { httpRouter } from 'convex/server';

// Webhook verification (svix, stripe) requires Node.js packages that cannot
// be bundled in the Convex runtime. Webhooks are handled in Next.js API routes:
//   POST /api/v1/webhooks/clerk  → calls internal.users.syncFromClerk
//   POST /api/v1/webhooks/stripe → calls subscriptionInternal.upsertFromStripe

const http = httpRouter();

export default http;
