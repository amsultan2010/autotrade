/** Append an audit-log entry for sensitive/admin actions (req #7, #15). */
import { prisma } from './prisma';

export async function writeAudit(params: {
  actorId?: string | null;
  action: string;
  target?: string | null;
  meta?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        target: params.target ?? null,
        meta: (params.meta ?? undefined) as object | undefined,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Auditing must never break the request path; failures are non-fatal.
  }
}
