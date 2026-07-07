import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/api-response';
import { recordScanCompleted } from '@/lib/db/scan';

function formatInternalApiError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message;
    if (typeof message === 'string' && message.length > 0) {
      return `Bot run failed (HTTP ${status}): ${message}`;
    }
  } catch {
    /* not JSON */
  }
  const snippet = body.startsWith('<!DOCTYPE') ? 'server error. Check Vercel logs' : body.slice(0, 200);
  return `Bot run failed (HTTP ${status}): ${snippet}`;
}

export async function POST() {
  try {
    const user = await requireUser();
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
    if (!botSecret || !appUrl) {
      return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
    }

    const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const res = await fetch(`${baseUrl}/api/internal/bot/run-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': botSecret },
      body: JSON.stringify({ clerkId: user.clerkId, manual: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: formatInternalApiError(res.status, text) }, { status: 502 });
    }

    await recordScanCompleted(user.clerkId, Date.now());
    return NextResponse.json(await res.json());
  } catch (err) {
    return handleError(err, { route: '/api/v1/bot/run-now' });
  }
}
