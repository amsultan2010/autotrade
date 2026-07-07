import { type NextRequest, NextResponse } from 'next/server';
import { verifyBotSecret } from '@/lib/internal-auth';
import { getDecryptedKeys } from '@/lib/db/broker';
import { handleError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'BOT_INTERNAL_SECRET not configured' }, { status: 500 });
  }

  try {
    verifyBotSecret(req.headers.get('x-internal-secret'));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clerkId = req.nextUrl.searchParams.get('clerkId');
  const paper = req.nextUrl.searchParams.get('paper') === 'true';
  if (!clerkId) {
    return NextResponse.json({ error: 'Missing clerkId' }, { status: 400 });
  }

  try {
    const keys = await getDecryptedKeys(clerkId, paper);
    return NextResponse.json(keys);
  } catch (err) {
    return handleError(err, { route: '/api/internal/broker/keys' });
  }
}
