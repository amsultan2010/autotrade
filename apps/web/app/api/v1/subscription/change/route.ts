import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { changeSubscription, env } from '@autotrade/engine/public';
import { capture } from '@/lib/analytics';

const bodySchema = z.object({
  tier: z.enum(['essential', 'pro', 'unlimited']),
});

export async function POST(req: Request) {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json({ error: 'Billing is not enabled' }, { status: 503 });
  }
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    capture(user.clerkId, {
      event: 'subscription_upgraded',
      properties: { userId: user.clerkId, plan: body.tier },
    });
    return ok(await changeSubscription(user.clerkId, body.tier));
  } catch (err) {
    return handleError(err);
  }
}
