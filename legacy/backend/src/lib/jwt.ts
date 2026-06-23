/** Access-token (JWT) signing and verification. */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '@autotrade/shared';

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  role: Role;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'autotrade',
    audience: 'autotrade-desktop',
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'autotrade',
    audience: 'autotrade-desktop',
  });
  // jwt.verify returns string | JwtPayload; we always sign objects.
  const payload = decoded as jwt.JwtPayload;
  return { sub: String(payload.sub), email: payload.email, role: payload.role };
}
