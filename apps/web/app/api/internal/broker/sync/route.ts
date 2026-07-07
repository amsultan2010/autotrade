/**
 * Legacy broker sync hook — no-op. Credentials are stored in Supabase via /api/v1/broker/connect.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
