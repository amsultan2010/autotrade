import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleError } from '@/lib/api-response';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ settings: [] });
  } catch (err) {
    return handleError(err);
  }
}
