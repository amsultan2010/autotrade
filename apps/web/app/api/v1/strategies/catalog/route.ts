import { getGroupedCatalog } from '@autotrade/engine/public';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    await requireUser();
    const grouped = getGroupedCatalog();
    return ok(grouped);
  } catch (err) {
    return handleError(err, { route: '/api/v1/strategies/catalog' });
  }
}
