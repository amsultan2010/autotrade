import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Landing } from '@/src/pages/Landing';

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');
  return <Landing />;
}
