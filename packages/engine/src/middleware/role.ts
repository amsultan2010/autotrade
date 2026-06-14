/**
 * roleGuard — restricts a route to specific roles (req #3, #7).
 * Returns a preHandler; must run AFTER authGuard.
 *
 *   fastify.get('/admin/users', { preHandler: [authGuard, roleGuard(['ADMIN','DEVELOPER'])] }, ...)
 */
import type { Role } from '@autotrade/shared';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

export function roleGuard(allowed: Role[]) {
  return function (user: { role: Role } | null): void {
    if (!user) throw new UnauthorizedError();
    if (!allowed.includes(user.role)) {
      throw new ForbiddenError('Insufficient privileges');
    }
  };
}
