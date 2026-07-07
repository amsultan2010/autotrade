import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { switchPreset } from '@/lib/db/botSettings';

const presetSchema = z.object({
  presetId: z.string(),
  stockStrategies: z.array(z.string()),
  cryptoStrategies: z.array(z.string()),
  includeExperimental: z.boolean(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  minConfidence: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = presetSchema.parse(await req.json());
    return ok(await switchPreset(user.clerkId, body));
  } catch (err) {
    return handleError(err, { route: '/api/v1/bot-settings/preset' });
  }
}
