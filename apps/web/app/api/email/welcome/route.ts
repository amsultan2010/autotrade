import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const name = parsed.data.name ?? user.email.split('@')[0] ?? 'Trader';
    const result = await sendWelcomeEmail(user.email, name);
    return NextResponse.json({ success: true, id: result.data?.id });
  } catch {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
