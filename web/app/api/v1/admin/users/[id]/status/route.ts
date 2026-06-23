import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { USER_STATUSES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { convexToken } from '@/lib/convex-auth-token';
import { parse } from '@autotrade/engine/public';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const token = await convexToken();
    const { id } = await params;
    const { status } = parse(z.object({ status: z.enum(USER_STATUSES) }), await req.json() as unknown);
    return ok(await fetchMutation(api.admin.setUserStatus, { clerkId: id, status }, { token }));
  } catch (err) {
    return handleError(err);
  }
}
