import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { ROLES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { convexToken } from '@/lib/convex-auth-token';
import { parse } from '@autotrade/engine/public';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const token = await convexToken();
    const { id } = await params;
    const { role } = parse(z.object({ role: z.enum(ROLES) }), await req.json() as unknown);
    return ok(await fetchMutation(api.admin.setUserRole, { clerkId: id, role }, { token }));
  } catch (err) {
    return handleError(err);
  }
}
