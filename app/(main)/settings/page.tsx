import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { ApiKeyForm } from '@/components/settings/ApiKeyForm';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { TagManager } from '@/components/settings/TagManager';

export default async function SettingsPage() {
  const user = await getSession();
  if (user === null) redirect('/login');

  return (
    <main className="max-w-[700px] mx-auto px-8 py-10">
      <div className="mb-1">
        <span className="font-en text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--yg-coral)' }}>
          設定 · Settings
        </span>
      </div>
      <h1 className="font-jp text-[36px] font-medium tracking-tight mb-1.5" style={{ color: 'var(--yg-ink)' }}>
        設定
      </h1>
      <p className="font-en text-sm mb-7" style={{ color: 'var(--yg-ink-soft)' }}>
        Choose your AI provider and configure API keys. Shiori uses your key for text import, furigana, grammar analysis, and vocabulary lookups.
      </p>

      <div
        className="rounded-2xl px-7 py-6 border mb-4"
        style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
      >
        <h2 className="font-en text-[14px] font-semibold mb-4" style={{ color: 'var(--yg-ink)' }}>
          Profile
        </h2>
        <ProfileForm currentName={user.name} />
      </div>

      <div
        className="rounded-2xl px-7 py-6 border mb-4"
        style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
      >
        <ApiKeyForm
          hasOpenRouterKey={user.openrouter_api_key !== null}
          openrouterModel={user.openrouter_model}
        />
      </div>

      <TagManager />
    </main>
  );
}
