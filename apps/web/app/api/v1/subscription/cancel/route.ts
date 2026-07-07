import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { cancelSubscription, reactivateSubscription, env } from '@autotrade/engine/public';
import { capture } from '@/lib/analytics';

export async function POST(req: Request) {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json({ error: 'Billing is not enabled' }, { status: 503 });
  }
  try {
    const user = await requireUser();
    const { action } = (await req.json()) as { action?: string };
    if (action === 'reactivate') {
      return ok(await reactivateSubscription(user.clerkId));
    }
    capture(user.clerkId, { event: 'subscription_canceled', properties: { userId: user.clerkId } });
    return ok(await cancelSubscription(user.clerkId));
  } catch (err) {
    return handleError(err);
  }
}
