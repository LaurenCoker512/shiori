import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SiteNav } from '@/components/ui/SiteNav';
import { ImportToastProvider } from '@/components/ui/ImportToastProvider';
import { UserNameProvider } from '@/components/ui/UserNameContext';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user === null) redirect('/login');

  return (
    <UserNameProvider initialName={user.name}>
      <ImportToastProvider>
        <SiteNav />
        <div className="relative z-10 pt-16">
          {children}
        </div>
      </ImportToastProvider>
    </UserNameProvider>
  );
}
