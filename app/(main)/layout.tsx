import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SiteNav } from '@/components/ui/SiteNav';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user === null) redirect('/login');

  return (
    <>
      <SiteNav user={user} />
      <div className="relative z-10 pt-16">
        {children}
      </div>
    </>
  );
}
