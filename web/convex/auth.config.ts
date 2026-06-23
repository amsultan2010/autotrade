// Convex reads this to verify Clerk JWTs on every authenticated call.
// CLERK_JWT_ISSUER_DOMAIN must be set in the Convex dashboard environment variables.
// Format: https://<your-clerk-subdomain>.clerk.accounts.dev
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!domain) {
  throw new Error('CLERK_JWT_ISSUER_DOMAIN environment variable is not set');
}

export default {
  providers: [
    {
      domain,
      applicationID: 'convex',
    },
  ],
};
