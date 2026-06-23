import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { convexToken } from '@/lib/convex-auth-token';
import { NotFoundError } from '@autotrade/engine/public';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const token = await convexToken();
    const { id } = await params;
    const user = await fetchQuery(api.admin.getUser, { clerkId: id }, { token });
    if (!user) throw new NotFoundError('User not found');
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}
