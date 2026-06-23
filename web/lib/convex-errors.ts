import { ConvexError } from 'convex/values';

/** Extract a user-facing message from a Convex client or server error. */
export function parseConvexErrorMessage(err: unknown): string | null {
  if (err instanceof ConvexError) {
    const { data } = err;
    if (typeof data === 'string' && data.length > 0) return data;
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }

  if (err instanceof Error) {
    const uncaught = err.message.match(/Uncaught ConvexError: ([^\n]+)/);
    if (uncaught?.[1]) return uncaught[1];

    if (err.message.includes('Unauthenticated')) {
      return 'Session not ready — wait a moment and try again, or sign out and back in.';
    }
  }

  return null;
}
