import { type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { ForbiddenError } from '@autotrade/engine/public';
import { getFounderSettings, patchUser } from '@/lib/db/users';

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
    const { plan } = (await req.json()) as { plan: string | null };
    await patchUser(user.clerkId, {
      founderPlanOverride: plan as 'free' | 'essential' | 'pro' | 'unlimited' | null,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, { route: '/api/v1/users/founder-settings' });
  }
}
