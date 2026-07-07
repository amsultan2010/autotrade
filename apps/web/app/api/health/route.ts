import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'autotrade-web',
    timestamp: new Date().toISOString(),
  });
}
