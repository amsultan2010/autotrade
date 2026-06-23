import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { loadUserBroker } from '@autotrade/engine/public';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const broker = await loadUserBroker(user.id);
    if (!broker) return ok([]);
    const positions = await broker.getPositions();
    return ok(positions);
  } catch (err) {
    return handleError(err);
  }
}
