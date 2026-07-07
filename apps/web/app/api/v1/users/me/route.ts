import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { me, patchUser } from '@/lib/db/users';

const patchSchema = z.object({
  alpacaGuideCompleted: z.boolean().optional(),
  productTourCompleted: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  founderPlanOverride: z.enum(['free', 'essential', 'pro', 'unlimited']).nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await me(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/users/me' });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await req.json());
    return ok(await patchUser(user.clerkId, body));
  } catch (err) {
    return handleError(err);
  }
}
