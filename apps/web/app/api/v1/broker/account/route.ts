import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { loadUserBroker } from '@autotrade/engine';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const broker = await loadUserBroker(user.id);
    if (!broker) return ok(null);
    const account = await broker.getAccount();
    return ok({ ...account, mode: broker.mode });
  } catch (err) {
    return handleError(err);
  }
}
