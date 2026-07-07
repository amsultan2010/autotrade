import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/internal-auth';
import { getUsersDueForScan, recordScanCompleted } from '@/lib/db/scan';
import { getSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 300;

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
  return `Bot run failed (HTTP ${status}): ${body.slice(0, 200)}`;
}

async function recordBotCycle(meta: {
  clerkId: string;
  success: boolean;
  error?: string;
  signalsGenerated?: number;
  tradesOpened?: number;
}): Promise<void> {
  try {
    await getSupabaseServer().from('audit_logs').insert({
      actor_clerk_id: meta.clerkId,
      action: 'bot_cycle',
      meta: {
        success: meta.success,
        error: meta.error,
        signalsGenerated: meta.signalsGenerated,
        tradesOpened: meta.tradesOpened,
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request) {
  return runScanAll(req);
}

export async function GET(req: Request) {
  return runScanAll(req);
}

async function runScanAll(req: Request) {
  try {
    verifyCronAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botSecret = process.env.BOT_INTERNAL_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!botSecret || !appUrl) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
  }

  const clerkIds = await getUsersDueForScan(Date.now());
  const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;

  await Promise.allSettled(
    clerkIds.map(async (clerkId) => {
      try {
        const res = await fetch(`${baseUrl}/api/internal/bot/run-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': botSecret,
          },
          body: JSON.stringify({ clerkId }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(formatInternalApiError(res.status, text));
        }

        const data = (await res.json()) as { signalsGenerated?: number; tradesOpened?: number };
        const completedAt = Date.now();
        await recordScanCompleted(clerkId, completedAt);
        await recordBotCycle({
          clerkId,
          success: true,
          signalsGenerated: data.signalsGenerated,
          tradesOpened: data.tradesOpened,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordBotCycle({ clerkId, success: false, error: msg });
      }
    }),
  );

  return NextResponse.json({ users: clerkIds.length });
}
