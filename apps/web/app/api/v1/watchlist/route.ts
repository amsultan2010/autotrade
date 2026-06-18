import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse } from '@autotrade/engine';

const addSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  exchange: z.string().min(1).max(40).default('US'),
  mic: z.string().max(10).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await prisma.watchedSymbol.findMany({ where: { userId: user.id }, orderBy: { addedAt: 'asc' } }));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = parse(addSchema, await req.json() as unknown);
    const created = await prisma.watchedSymbol.upsert({
      where: { userId_symbol_exchange: { userId: user.id, symbol: body.symbol, exchange: body.exchange } },
      update: {},
      create: { userId: user.id, symbol: body.symbol, exchange: body.exchange, mic: body.mic },
    });
    return ok(created, 201);
  } catch (err) {
    return handleError(err);
  }
}
