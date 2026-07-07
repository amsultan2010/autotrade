import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { me } from '@/lib/db/users';
import { Admin } from '@/src/views/Admin';

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await me(userId);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) {
    redirect('/dashboard');
  }

  return <Admin />;
}
