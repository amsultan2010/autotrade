import { NextResponse } from 'next/server';
import { sendTradeAlert } from '@/lib/email';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  trade: z.object({
    symbol: z.string().min(1).max(20).regex(/^[A-Z0-9./-]+$/i),
    action: z.enum(['BUY', 'SELL']),
    quantity: z.number().positive(),
    price: z.number().positive(),
    pnl: z.number().optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const result = await sendTradeAlert(user.email, parsed.data.trade);
    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Not signed in')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to send alert' }, { status: 500 });
  }
}
