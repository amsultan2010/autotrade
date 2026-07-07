import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { USER_STATUSES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { setUserStatus } from '@/lib/db/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status } = parse(z.object({ status: z.enum(USER_STATUSES) }), await req.json() as unknown);
    return ok(await setUserStatus(admin.clerkId, id, status));
  } catch (err) {
    return handleError(err);
  }
}
