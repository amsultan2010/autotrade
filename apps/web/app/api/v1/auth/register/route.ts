import { NextResponse } from 'next/server';

// Registration is handled by Clerk. This stub exists for legacy client compatibility.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'USE_CLERK', message: 'Registration is handled via Clerk' } },
    { status: 410 },
  );
}
