/** Access-token (JWT) signing and verification. */
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '@autotrade/shared';

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  role: Role;
}

function requireJwtAccessSecret(): string {
  if (!env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }
  return env.JWT_ACCESS_SECRET;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, requireJwtAccessSecret(), {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'autotrade',
    audience: 'autotrade-desktop',
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, requireJwtAccessSecret(), {
    issuer: 'autotrade',
    audience: 'autotrade-desktop',
  });
  // jwt.verify returns string | JwtPayload; we always sign objects.
  const payload = decoded as jwt.JwtPayload;
  return { sub: String(payload.sub), email: payload.email, role: payload.role };
}
