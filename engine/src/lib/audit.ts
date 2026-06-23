/** Append an audit-log entry for sensitive/admin actions (req #7, #15). */
import * as db from './convex-db';

export async function writeAudit(params: {
  actorClerkId?: string | null;
  action: string;
  target?: string | null;
  meta?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.writeAuditLog({
      actorClerkId: params.actorClerkId ?? undefined,
      action: params.action,
      target: params.target ?? undefined,
      meta: params.meta,
      ip: params.ip ?? undefined,
    });
  } catch {
    // Auditing must never break the request path; failures are non-fatal.
  }
}
