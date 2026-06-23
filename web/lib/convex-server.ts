import { ConvexHttpClient } from 'convex/browser';

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not set');

// Server-side client for Next.js API routes and Server Components.
// Does not carry user auth — use for internal mutations only.
export const convexServer = new ConvexHttpClient(convexUrl);
