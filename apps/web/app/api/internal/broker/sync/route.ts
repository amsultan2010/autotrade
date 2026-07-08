/**
 * Legacy broker sync hook — no-op. Credentials are stored in Supabase via /api/v1/broker/connect.
 * Kept authenticated so a future implementation cannot ship without auth.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { isBotAuth } from '@/lib/internal-auth';

export async function POST(req: NextRequest) {
  if (!isBotAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isBotAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
