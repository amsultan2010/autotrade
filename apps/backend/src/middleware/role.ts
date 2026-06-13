/**
 * roleGuard — restricts a route to specific roles (req #3, #7).
 * Returns a preHandler; must run AFTER authGuard.
 *
 *   fastify.get('/admin/users', { preHandler: [authGuard, roleGuard(['ADMIN','DEVELOPER'])] }, ...)
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@alphabot/shared';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export function roleGuard(allowed: Role[]) {
  return async function (req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = req.authUser;
    if (!user) throw new UnauthorizedError();
    if (!allowed.includes(user.role)) {
      throw new ForbiddenError('Insufficient privileges');
    }
  };
}
