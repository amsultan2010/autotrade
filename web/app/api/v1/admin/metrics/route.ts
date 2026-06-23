import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { convexToken } from '@/lib/convex-auth-token';

export async function GET() {
  try {
    await requireAdmin();
    const token = await convexToken();
    return ok(await fetchQuery(api.admin.metrics, {}, { token }));
  } catch (err) {
    return handleError(err);
  }
}
