import { NextResponse } from 'next/server';

// Token refresh is handled by Clerk. This stub exists for legacy client compatibility.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'USE_CLERK', message: 'Token refresh is handled by Clerk automatically' } },
    { status: 410 },
  );
}
