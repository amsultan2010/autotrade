/**
 * Proxies browser Sentry envelopes to ingest (ad-blocker safe).
 * Host is allowlisted to prevent open-proxy / SSRF abuse.
 */
import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST_SUFFIXES = ['.ingest.sentry.io', '.ingest.us.sentry.io'];

function isAllowedSentryHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'ingest.sentry.io' || h === 'ingest.us.sentry.io') return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body.trim()) return NextResponse.json({ error: 'empty envelope' }, { status: 400 });

    const headerLine = body.split('\n').find((line) => line.trim().startsWith('{'));
    if (!headerLine) return NextResponse.json({ error: 'invalid envelope' }, { status: 400 });

    const envelopeHeader = JSON.parse(headerLine) as { dsn?: string };
    if (!envelopeHeader.dsn) return NextResponse.json({ error: 'missing dsn' }, { status: 400 });

    const dsn = new URL(envelopeHeader.dsn);
    if (dsn.protocol !== 'https:') {
      return NextResponse.json({ error: 'invalid dsn protocol' }, { status: 400 });
    }
    if (!isAllowedSentryHost(dsn.hostname)) {
      return NextResponse.json({ error: 'dsn host not allowed' }, { status: 400 });
    }

    const projectId = dsn.pathname.replace(/^\//, '');
    if (!/^\d+$/.test(projectId)) {
      return NextResponse.json({ error: 'invalid project id' }, { status: 400 });
    }

    const upstream = `https://${dsn.hostname}/api/${projectId}/envelope/`;

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
