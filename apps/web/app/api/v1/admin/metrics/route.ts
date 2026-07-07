import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getSupabaseServer } from '@/lib/supabase-server';
import { metrics } from '@/lib/db/admin';

export async function GET() {
  try {
    await requireAdmin();
    const data = await metrics();
    try {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const { count } = await getSupabaseServer()
        .from('signals')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since);
      return ok({ ...data, signals24h: count ?? 0 });
    } catch {
      return ok(data);
    }
  } catch (err) {
    return handleError(err);
  }
}
