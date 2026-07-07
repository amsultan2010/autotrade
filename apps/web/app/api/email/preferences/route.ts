import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { syncWeeklyDigestPreference } from '@/lib/resend-audience';

const schema = z.object({ enabled: z.boolean() });

/** Sync weekly digest opt-in/out to Resend audience (Convex stores canonical preference). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    await syncWeeklyDigestPreference(user.email, body.enabled, user.clerkId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update email preferences' }, { status: 500 });
  }
}
