import { type NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api-response';
import { handleWebhook } from '@autotrade/engine';

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get('stripe-signature') ?? undefined;
    const raw = Buffer.from(await req.arrayBuffer());
    await handleWebhook(raw, sig);
    return ok({ received: true });
  } catch (err) {
    return handleError(err);
  }
}
