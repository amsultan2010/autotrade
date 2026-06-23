/** Common preHandler bundles. */
import { authGuard } from './auth.js';
import { subscriptionGuard } from './subscription.js';
import { roleGuard } from './role.js';

/** Authenticated only. */
export const requireAuth = { preHandler: [authGuard] };

/** Authenticated AND entitled (active subscription or admin/dev role). */
export const requireEntitled = { preHandler: [authGuard, subscriptionGuard] };

/** Authenticated AND admin/developer. */
export const requireAdmin = { preHandler: [authGuard, roleGuard(['ADMIN', 'DEVELOPER'])] };
