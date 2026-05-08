'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

const LONG_TEXT_THRESHOLD = 30000;

const STEPS = ['Upload', 'Analyze', 'Review'];

export function ImportForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLongText, setIsLongText] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.txt$/i, ''));
    }

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setContent(text);
      setIsLongText(text.length > LONG_TEXT_THRESHOLD);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Import failed');
        return;
      }
      const data = await response.json() as { id: number };
      try {
        localStorage.setItem('shiori-import', JSON.stringify({ id: data.id, title: title.trim() }));
        window.dispatchEvent(new Event('shiori-import-created'));
      } catch { /* storage unavailable — toast won't appear but import still works */ }
      router.push('/');
    } catch {
      setError('Import failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const step = isSubmitting ? 1 : 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Stepper */}
      <div
        className="flex items-center gap-3 px-[18px] py-3.5 rounded-xl border"
        style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
      >
        {STEPS.map((s, i) => (
          <>
            <div key={s} className="flex items-center gap-2 shrink-0">
              <span
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center font-en text-[11px] font-semibold"
                style={{
                  background: i <= step ? 'var(--yg-coral)' : 'transparent',
                  border: `1.5px solid ${i <= step ? 'var(--yg-coral)' : 'var(--yg-rule)'}`,
                  color: i <= step ? '#faf3df' : 'var(--yg-ink-muted)',
                }}
              >
                {i + 1}
              </span>
              <span
                className="font-en text-[12px]"
                style={{
                  color: i === step ? 'var(--yg-ink)' : 'var(--yg-ink-soft)',
                  fontWeight: i === step ? 600 : 500,
                }}
              >
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                key={`connector-${i}`}
                className="flex-1 h-px"
                style={{
                  background: i < step ? 'var(--yg-coral)' : 'var(--yg-rule)',
                  opacity: 0.6,
                }}
              />
            )}
          </>
        ))}
      </div>

      {!isSubmitting ? (
        <>
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="font-en text-[13px] font-medium" style={{ color: 'var(--yg-ink)' }}>
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="font-en text-[14px] rounded-xl px-4 py-2.5 border outline-none"
              style={{
                background: 'var(--yg-paper-hi)',
                borderColor: 'var(--yg-rule)',
                color: 'var(--yg-ink)',
              }}
            />
          </div>

          {/* Drop zone */}
          <div
            className="rounded-2xl text-center p-14 relative border-2 border-dashed"
            style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center font-jp text-3xl font-medium"
              style={{
                background: 'linear-gradient(160deg, var(--yg-coral), var(--yg-coral-dark))',
                color: '#faf3df',
                boxShadow: '0 6px 20px rgba(157, 90, 106, 0.24)',
              }}
              aria-hidden="true"
            >
              文
            </div>
            <h3 className="font-jp text-[20px] font-medium mb-1.5" style={{ color: 'var(--yg-ink)' }}>
              テキストファイルを置いてください。
            </h3>
            <p className="font-en text-[13px] mb-5" style={{ color: 'var(--yg-ink-soft)' }}>
              Drag &amp; drop a .txt file, or choose one below
            </p>
            <label
              htmlFor="file"
              className="font-en text-[13px] font-semibold inline-block px-5 py-2.5 rounded-full cursor-pointer"
              style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)' }}
            >
              {content ? 'File loaded ✓' : 'Choose file'}
            </label>
            <input
              id="file"
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {isLongText && (
            <div
              className="flex gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: 'var(--yg-known)' }}
            >
              <span className="font-jp text-[18px]" style={{ color: 'var(--yg-bamboo)' }} aria-hidden="true">※</span>
              <div>
                <div className="font-jp text-[13px] font-semibold mb-1" style={{ color: 'var(--yg-bamboo-dark)' }}>
                  ヒント · Tip
                </div>
                <div className="font-en text-[12px] leading-relaxed" style={{ color: 'var(--yg-bamboo-dark)' }}>
                  This is a long text — processing may take a moment.
                </div>
              </div>
            </div>
          )}

          {error !== null && (
            <p role="alert" className="font-en text-sm" style={{ color: 'var(--yg-coral-dark)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!title.trim() || !content || isSubmitting}
            className="font-en text-[13px] font-semibold px-6 py-3 rounded-full self-start disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
          >
            Import
          </button>
        </>
      ) : (
        /* Analyzing state */
        <div
          className="rounded-2xl px-7 py-10 text-center border"
          style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
        >
          <div
            className="font-jp text-[32px] mb-3 tracking-[6px]"
            style={{ color: 'var(--yg-coral)' }}
            aria-hidden="true"
          >
            ···
          </div>
          <div className="font-jp text-[20px] mb-1.5" style={{ color: 'var(--yg-ink)' }}>解析中…</div>
          <div className="font-en text-[13px] mb-5" style={{ color: 'var(--yg-ink-soft)' }}>
            Tokenizing, attaching readings, looking up definitions
          </div>
          <div
            className="h-1.5 rounded-full max-w-xs mx-auto overflow-hidden mb-2.5"
            style={{ background: 'rgba(42,36,28,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, var(--yg-coral), var(--yg-coral-dark))',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <div
            className="font-en text-[11px] tracking-[1px] uppercase"
            style={{ color: 'var(--yg-ink-muted)' }}
          >
            Analyzing&hellip;
          </div>
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        </div>
      )}
    </form>
  );
}
