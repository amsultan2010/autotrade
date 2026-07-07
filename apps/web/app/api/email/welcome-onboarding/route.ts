import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { deliverWelcomeEmail } from '@/lib/welcome-email';

/** Fallback welcome email when Clerk webhook was missed .  idempotent via Convex claim. */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Trader';

  try {
    const result = await deliverWelcomeEmail({
      clerkId: userId,
      email,
      name,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}
