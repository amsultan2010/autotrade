import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { ROLES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { setUserRole } from '@/lib/db/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { role } = parse(z.object({ role: z.enum(ROLES) }), await req.json() as unknown);
    return ok(await setUserRole(admin.clerkId, id, role));
  } catch (err) {
    return handleError(err);
  }
}
