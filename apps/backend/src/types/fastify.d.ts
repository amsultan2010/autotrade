import type { Role, UserStatus } from '@alphabot/shared';

/** Authenticated principal attached to the request by authGuard. */
export interface RequestUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: RequestUser;
    /** Raw request body bytes — needed for Stripe webhook signature checks. */
    rawBody?: Buffer;
  }
}
