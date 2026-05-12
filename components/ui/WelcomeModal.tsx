'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'shiori-welcome-dismissed';

interface WelcomeModalProps {
  hasApiKey: boolean;
}

export function WelcomeModal({ hasApiKey }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasApiKey) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
    } catch { /* storage unavailable */ }
    setVisible(true);
  }, [hasApiKey]);

  function dismiss() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage unavailable */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(44,42,40,0.45)' }}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full mx-4"
        style={{
          background: 'var(--yg-paper-hi)',
          border: '1px solid var(--yg-rule)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
      >
        <div className="mb-1">
          <span
            className="font-en text-[11px] font-semibold tracking-[1.5px] uppercase"
            style={{ color: 'var(--yg-coral)' }}
          >
            ようこそ · Welcome
          </span>
        </div>
        <h2
          id="welcome-modal-title"
          className="font-jp text-[24px] font-medium tracking-tight mb-3"
          style={{ color: 'var(--yg-ink)' }}
        >
          まず設定をしましょう。
        </h2>
        <p className="font-en text-[13px] leading-relaxed mb-6" style={{ color: 'var(--yg-ink-soft)' }}>
          Shiori uses OpenRouter to tokenize texts and look up words. Add your OpenRouter API key in Settings to get started.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 px-5 py-2 rounded-full font-en text-[13px] font-medium border transition-colors"
            style={{
              color: 'var(--yg-ink-soft)',
              borderColor: 'var(--yg-rule)',
              backgroundColor: 'transparent',
            }}
          >
            Later
          </button>
          <Link
            href="/settings"
            onClick={dismiss}
            className="min-h-11 px-5 py-2 rounded-full font-en text-[13px] font-semibold flex items-center"
            style={{
              backgroundColor: 'var(--yg-ink)',
              color: 'var(--yg-paper-hi)',
              textDecoration: 'none',
            }}
          >
            Go to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
