import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { NotFoundError } from '@autotrade/engine/public';
import { getUser } from '@/lib/db/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await getUser(id);
    if (!user) throw new NotFoundError('User not found');
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}
