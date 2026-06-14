import { NextResponse } from 'next/server';

// Logout is handled by Clerk on the client. This stub exists for legacy client compatibility.
export async function POST() {
  return NextResponse.json({ success: true });
}
