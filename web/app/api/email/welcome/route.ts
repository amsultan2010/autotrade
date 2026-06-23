import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const result = await sendWelcomeEmail(parsed.data.email, parsed.data.name);
  return NextResponse.json({ success: true, id: result.data?.id });
}
