import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleError } from '@/lib/api-response';

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    await requireAdmin();
    // Provider settings are managed via environment variables
    return NextResponse.json({ key: key, updated: false, message: 'Use environment variables to configure providers' });
  } catch (err) {
    return handleError(err);
  }
}
