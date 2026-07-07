import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { ForbiddenError } from '@autotrade/engine/public';
import {
  getFounderSettings,
  founderLookupUser,
  founderPatchUserByEmail,
  patchUser,
} from '@/lib/db/users';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setPlan'),
    plan: z.enum(['free', 'essential', 'pro', 'unlimited']).nullable(),
  }),
  z.object({ action: z.literal('resetOnboarding') }),
  z.object({ action: z.literal('resetTour') }),
  z.object({ action: z.literal('resetAllFlows') }),
  z.object({ action: z.literal('lookupUser'), email: z.string().email() }),
  z.object({
    action: z.literal('patchUser'),
    email: z.string().email(),
    patch: z.object({
      alpacaGuideCompleted: z.boolean().optional(),
      productTourCompleted: z.boolean().optional(),
      weeklyDigestEnabled: z.boolean().optional(),
      founderPlanOverride: z.enum(['free', 'essential', 'pro', 'unlimited']).nullable().optional(),
    }),
  }),
]);

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getFounderSettings(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/users/founder-settings' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const settings = await getFounderSettings(user.clerkId);
    if (!settings) throw new ForbiddenError('Founder access required');

    const body = actionSchema.parse(await req.json());

    switch (body.action) {
      case 'setPlan':
        await patchUser(user.clerkId, { founderPlanOverride: body.plan });
        return ok({ ok: true });

      case 'resetOnboarding':
        await patchUser(user.clerkId, { alpacaGuideCompleted: false });
        return ok({ ok: true });

      case 'resetTour':
        await patchUser(user.clerkId, { productTourCompleted: false, alpacaGuideCompleted: true });
        return ok({ ok: true });

      case 'resetAllFlows':
        await patchUser(user.clerkId, { alpacaGuideCompleted: false, productTourCompleted: false });
        return ok({ ok: true });

      case 'lookupUser': {
        const found = await founderLookupUser(user.clerkId, body.email);
        return ok({ user: found });
      }

      case 'patchUser': {
        const updated = await founderPatchUserByEmail(user.clerkId, body.email, body.patch);
        return ok({ user: updated });
      }

      default:
        return ok({ ok: false });
    }
  } catch (err) {
    return handleError(err, { route: '/api/v1/users/founder-settings' });
  }
}
