'use client';

import { useState } from 'react';
import { useUserName } from '@/components/ui/UserNameContext';

export function ProfileForm({ currentName }: { currentName: string }) {
  const { setUserName } = useUserName();
  const [name, setName] = useState(currentName);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const trimmed = name.trim();
  const canSubmit = status !== 'saving' && trimmed !== '' && trimmed !== currentName;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('saving');
    setErrorMessage('');

    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    if (res.ok) {
      setUserName(trimmed);
      setStatus('saved');
    } else {
      const data = await res.json() as { error?: string };
      setErrorMessage(data.error ?? 'Failed to save');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="display-name" className="font-en text-[12px] font-medium" style={{ color: 'var(--yg-ink-soft)' }}>
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setStatus('idle'); }}
          className="font-en text-[13px] rounded-xl px-4 py-2.5 border outline-none"
          style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
          autoComplete="off"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="font-en text-[13px] font-semibold px-5 py-2.5 rounded-full disabled:opacity-40 transition-opacity"
          style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' && (
          <span className="font-en text-[13px]" style={{ color: 'var(--yg-bamboo-dark)' }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" className="font-en text-[13px]" style={{ color: 'var(--yg-coral-dark)' }}>
            {errorMessage}
          </span>
        )}
      </div>
    </form>
  );
}
