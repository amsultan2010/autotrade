import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { createCheckoutSession, env } from '@autotrade/engine/public';

export async function POST() {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json({ error: 'Billing is not enabled' }, { status: 503 });
  }
  try {
    const user = await requireUser();
    return ok(await createCheckoutSession(user.clerkId, user.email));
  } catch (err) {
    return handleError(err);
  }
}
