/** authGuard — verifies the bearer access token and loads the user. */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

export async function authGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user) throw new UnauthorizedError('User no longer exists');
  if (user.status === 'DISABLED') {
    throw new ForbiddenError('This account has been disabled');
  }

  req.authUser = user;
}
