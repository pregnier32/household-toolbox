import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  return (
    <DashboardClient
      user={{
        id: session.id,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        userStatus: session.userStatus,
        householdRole: session.householdRole,
      }}
    />
  );
}
