import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { SiteNav } from '@/components/ui/SiteNav';
import { ImportToastProvider } from '@/components/ui/ImportToastProvider';
import { ReparseToastProvider } from '@/components/ui/ReparseToastProvider';
import { UserNameProvider } from '@/components/ui/UserNameContext';
import { KnownWordCountProvider } from '@/components/ui/KnownWordCountContext';
import { WelcomeModal } from '@/components/ui/WelcomeModal';
import { JpdictSync } from '@/components/JpdictSync';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user === null) redirect('/login');

  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM words WHERE user_id = $1 AND status = $2',
    [user.id, 'known'],
  );
  const initialKnownCount = parseInt(countResult.rows[0].count, 10);

  return (
    <UserNameProvider initialName={user.name}>
      <KnownWordCountProvider initialCount={initialKnownCount}>
        <ImportToastProvider>
          <ReparseToastProvider>
            <JpdictSync />
            <SiteNav />
            <WelcomeModal hasApiKey={user.openrouter_api_key !== null} />
            <div className="relative z-10 pt-16">
              {children}
            </div>
          </ReparseToastProvider>
        </ImportToastProvider>
      </KnownWordCountProvider>
    </UserNameProvider>
  );
}
