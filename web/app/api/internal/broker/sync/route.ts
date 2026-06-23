/**
 * Legacy Postgres broker sync — no-op. Broker credentials live in Convex only.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
