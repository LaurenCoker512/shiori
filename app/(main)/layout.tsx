import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SiteNav } from '@/components/ui/SiteNav';
import { ImportToastProvider } from '@/components/ui/ImportToastProvider';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user === null) redirect('/login');

  return (
    <ImportToastProvider>
      <SiteNav user={user} />
      <div className="relative z-10 pt-16">
        {children}
      </div>
    </ImportToastProvider>
  );
}
