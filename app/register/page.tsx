'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
        return;
      }

      let errorMessage = 'Registration failed';
      try {
        const data = await res.json() as { error?: string };
        errorMessage = data.error ?? errorMessage;
      } catch {
        // non-JSON error body (e.g. server 500)
      }
      setError(errorMessage);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--yg-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-jp text-[42px] font-medium tracking-tight mb-1" style={{ color: 'var(--yg-coral)' }}>栞</div>
          <div className="font-jp text-[22px] font-medium tracking-tight" style={{ color: 'var(--yg-ink)' }}>shiori</div>
          <p className="font-en text-sm mt-1.5" style={{ color: 'var(--yg-ink-soft)' }}>Japanese reading tracker</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}>
          <h1 className="font-en text-[18px] font-semibold mb-6" style={{ color: 'var(--yg-ink)' }}>Create account</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="font-en text-[12px] font-medium tracking-wide" style={{ color: 'var(--yg-ink-soft)' }}>
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="rounded-lg px-3.5 py-2.5 border font-en text-[14px] outline-none transition-colors"
                style={{ background: 'var(--yg-paper)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="font-en text-[12px] font-medium tracking-wide" style={{ color: 'var(--yg-ink-soft)' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="rounded-lg px-3.5 py-2.5 border font-en text-[14px] outline-none transition-colors"
                style={{ background: 'var(--yg-paper)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="font-en text-[12px] font-medium tracking-wide" style={{ color: 'var(--yg-ink-soft)' }}>
                Password <span className="font-normal opacity-70">(min. 8 characters)</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="rounded-lg px-3.5 py-2.5 border font-en text-[14px] outline-none transition-colors"
                style={{ background: 'var(--yg-paper)', borderColor: 'var(--yg-rule)', color: 'var(--yg-ink)' }}
              />
            </div>

            {error !== null && (
              <p className="font-en text-[13px] text-red-600" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-full py-2.5 font-en text-[14px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center font-en text-[13px] mt-5" style={{ color: 'var(--yg-ink-soft)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--yg-coral-dark)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
