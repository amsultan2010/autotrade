// Convex reads this to verify Clerk JWTs on every authenticated call.
// CLERK_JWT_ISSUER_DOMAIN must be set in the Convex dashboard environment variables.
// Format: https://<your-clerk-subdomain>.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
};
