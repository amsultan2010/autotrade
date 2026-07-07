import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { capture } from '@/lib/analytics';
import { connectBroker, disconnectBroker } from '@/lib/db/broker';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = z.object({
      keyId: z.string(),
      secret: z.string(),
      paper: z.boolean(),
    }).parse(await req.json());
    const result = await connectBroker(user.clerkId, body);
    capture(user.clerkId, {
      event: 'broker_connected',
      properties: { userId: user.clerkId, broker: 'alpaca', paper: body.paper },
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    let paper = url.searchParams.get('paper') === 'true';
    if (!url.searchParams.has('paper')) {
      try {
        const body = (await req.json()) as { paper?: boolean };
        if (typeof body.paper === 'boolean') paper = body.paper;
      } catch {
        // no JSON body
      }
    }
    return ok(await disconnectBroker(user.clerkId, paper));
  } catch (err) {
    return handleError(err, { route: '/api/v1/broker/connect' });
  }
}
