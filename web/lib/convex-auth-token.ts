import { auth } from '@clerk/nextjs/server';

export async function convexToken(): Promise<string | undefined> {
  const { getToken } = await auth();
  return (await getToken({ template: 'convex' })) ?? undefined;
}
