'use client';

import { useEffect, useRef, useState } from 'react';
import type { Word } from '@/lib/types';
import { parseTranslations } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

interface WordPopoverProps {
  word: Word;
  anchorRect: DOMRect;
  onClose: () => void;
  onStatusUpdate: (word: Word) => void;
}

const STATUS_OPTS = [
  { id: 'unseen' as const, label: 'New',   jp: '未習' },
  { id: 'seen'   as const, label: 'Seen',  jp: '見た' },
  { id: 'known'  as const, label: 'Known', jp: '既習' },
];

export function WordPopover({ word, anchorRect, onClose, onStatusUpdate }: WordPopoverProps) {
  const [loadedTranslations, setLoadedTranslations] = useState<string[] | null>(null);
  const [translationLoading, setTranslationLoading] = useState(
    word.translation === null && word.user_translation === null,
  );
  const [markingStatus, setMarkingStatus] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (word.translation !== null || word.user_translation !== null) return;
    fetch(`/api/words/${word.id}/translation`)
      .then(r => r.json())
      .then((data: { translations?: string[] }) => {
        if (Array.isArray(data.translations)) setLoadedTranslations(data.translations);
        setTranslationLoading(false);
      })
      .catch(() => setTranslationLoading(false));
  }, [word.id, word.translation, word.user_translation]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (popoverRef.current !== null && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  async function handleSetStatus(newStatus: 'unseen' | 'seen' | 'known') {
    if (newStatus === word.status) return;
    setMarkingStatus(true);
    try {
      const res = await fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated: Word = await res.json();
      onStatusUpdate(updated);
    } finally {
      setMarkingStatus(false);
    }
  }

  const translationText =
    word.user_translation !== null
      ? null
      : word.translation !== null
        ? parseTranslations(word.translation).join(' / ')
        : loadedTranslations !== null
          ? loadedTranslations.join(' / ')
          : null;

  const statusBadgeStyle: React.CSSProperties = word.status === 'known'
    ? { background: 'var(--yg-known)', color: 'var(--yg-bamboo-dark)' }
    : word.status === 'seen'
      ? { background: 'var(--yg-seen)', color: 'var(--yg-coral-dark)' }
      : { background: 'rgba(42,36,28,0.06)', color: 'var(--yg-ink-soft)' };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Word details: ${word.dictionary_form}`}
      className="fixed z-50 flex flex-col overflow-hidden"
      style={{
        top: 76,
        right: 12,
        width: 340,
        maxHeight: 'calc(100vh - 88px)',
        background: 'var(--yg-paper-hi)',
        borderRadius: 16,
        border: '1px solid var(--yg-rule)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5 relative border-b"
        style={{
          background: 'linear-gradient(135deg, var(--yg-paper-hi), var(--yg-paper))',
          borderColor: 'var(--yg-rule)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close word panel"
          className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full font-en text-sm"
          style={{
            background: 'rgba(42,36,28,0.06)',
            border: 'none',
            color: 'var(--yg-ink-soft)',
            cursor: 'pointer',
          }}
        >
          ×
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-en text-[10px] font-semibold tracking-[1px] uppercase px-2 py-0.5 rounded-full"
            style={statusBadgeStyle}
          >
            {STATUS_OPTS.find(s => s.id === word.status)?.label ?? 'New'}
          </span>
          {word.jlpt_level !== null && (
            <span className="font-en text-[11px]" style={{ color: 'var(--yg-ink-muted)' }}>
              {word.jlpt_level}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-jp text-[42px] font-medium leading-none tracking-tight" style={{ color: 'var(--yg-ink)' }}>
            {word.dictionary_form}
          </span>
          <span className="font-jp text-[17px] tracking-wide" style={{ color: 'var(--yg-ink-soft)' }}>
            {word.reading}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Meaning */}
        <div className="mb-5">
          <div className="font-en text-[11px] font-semibold tracking-[1.4px] uppercase mb-2" style={{ color: 'var(--yg-ink-muted)' }}>
            Meaning
          </div>
          <div aria-live="polite" aria-atomic="true" className="font-en text-[15px] leading-relaxed" style={{ color: 'var(--yg-ink)' }}>
            {translationLoading ? (
              <Spinner />
            ) : word.user_translation !== null ? (
              <>
                <span role="img" aria-label="Custom translation">✏️</span>
                {' '}{word.user_translation}
              </>
            ) : (
              translationText ?? <span style={{ color: 'var(--yg-ink-muted)' }}>No translation available</span>
            )}
          </div>
        </div>

        {/* Status toggle */}
        <div className="mb-5">
          <div className="font-en text-[11px] font-semibold tracking-[1.4px] uppercase mb-2" style={{ color: 'var(--yg-ink-muted)' }}>
            Status
          </div>
          <div
            className="flex gap-1 p-1 rounded-[10px]"
            style={{ background: 'rgba(42,36,28,0.06)' }}
          >
            {STATUS_OPTS.map(opt => {
              const active = word.status === opt.id;
              const activeColor = opt.id === 'known'
                ? 'var(--yg-bamboo)'
                : opt.id === 'seen'
                  ? 'var(--yg-coral)'
                  : 'var(--yg-ink-soft)';
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { void handleSetStatus(opt.id); }}
                  disabled={markingStatus}
                  className="flex-1 py-2 rounded-[7px] text-center transition-all font-en text-xs font-semibold leading-tight"
                  style={{
                    background: active ? '#fff' : 'transparent',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    color: active ? activeColor : 'var(--yg-ink-soft)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                  <div className="font-jp text-[10px] mt-0.5 opacity-70 font-medium">{opt.jp}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3.5 flex gap-2 border-t"
        style={{ borderColor: 'var(--yg-rule)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-full font-en text-xs font-semibold"
          style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
