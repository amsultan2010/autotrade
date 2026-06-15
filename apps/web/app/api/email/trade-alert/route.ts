import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { sendTradeAlert } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  trade: z.object({
    symbol: z.string(),
    action: z.enum(['BUY', 'SELL']),
    quantity: z.number().positive(),
    price: z.number().positive(),
    pnl: z.number().optional(),
  }),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const result = await sendTradeAlert(parsed.data.email, parsed.data.trade);
  return NextResponse.json({ success: true, id: result.data?.id });
}
