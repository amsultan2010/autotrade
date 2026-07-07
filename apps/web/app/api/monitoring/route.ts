import { type NextRequest, NextResponse } from 'next/server';

/**
 * Proxies browser Sentry envelopes to ingest (ad-blocker safe).
 * Replaces the fragile Next.js rewrite tunnel which 404'd on Vercel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body.trim()) return NextResponse.json({ error: 'empty envelope' }, { status: 400 });

    const headerLine = body.split('\n').find((line) => line.trim().startsWith('{'));
    if (!headerLine) return NextResponse.json({ error: 'invalid envelope' }, { status: 400 });

    const envelopeHeader = JSON.parse(headerLine) as { dsn?: string };
    if (!envelopeHeader.dsn) return NextResponse.json({ error: 'missing dsn' }, { status: 400 });

    const dsn = new URL(envelopeHeader.dsn);
    const projectId = dsn.pathname.replace(/^\//, '');
    const upstream = `https://${dsn.host}/api/${projectId}/envelope/`;

    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'User-Agent': 'autotrade-sentry-tunnel',
      },
      body,
    });

    return new NextResponse(null, { status: upstreamRes.status });
  } catch (err) {
    console.error('sentry tunnel failed', err);
    return NextResponse.json({ error: 'tunnel failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'sentry-tunnel' });
}
