import { NextResponse } from 'next/server';

// Login is handled by Clerk. This stub exists for legacy client compatibility.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'USE_CLERK', message: 'Login is handled via Clerk' } },
    { status: 410 },
  );
}
