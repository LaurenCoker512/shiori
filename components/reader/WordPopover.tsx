'use client';

import { useEffect, useRef, useState } from 'react';
import type { JMdictEntry, Word } from '@/lib/types';
import { parseTranslations } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';
import { useKnownWordCount } from '@/components/ui/KnownWordCountContext';
import { lookupWord } from '@/lib/jmdict';

interface WordPopoverProps {
  word: Word;
  anchorRect: DOMRect;
  surface?: string;
  currentFurigana?: string;
  onClose: () => void;
  onStatusUpdate: (word: Word) => void;
  onFuriganaEdit?: (surface: string, newReading: string) => void;
}

type TranslationState =
  | { kind: 'loading' }
  | { kind: 'jmdict'; entry: JMdictEntry }
  | { kind: 'llm'; translations: string[] }
  | { kind: 'no-api-key' }
  | { kind: 'error' };

const STATUS_OPTS = [
  { id: 'unseen' as const, label: 'New',   jp: '未習' },
  { id: 'seen'   as const, label: 'Seen',  jp: '見た' },
  { id: 'known'  as const, label: 'Known', jp: '既習' },
];

function JMdictDisplay({ entry }: { entry: JMdictEntry }) {
  const hasMultiplePos = new Set(entry.senses.flatMap((s) => s.pos)).size > 1;

  return (
    <div>
      {entry.senses.map((sense, i) => (
        <div key={i}>
          {hasMultiplePos && sense.pos.length > 0 && (
            <span className="text-xs text-muted-foreground">{sense.pos.join(', ')}</span>
          )}
          <p>{sense.glosses.join('; ')}</p>
          {sense.info !== undefined && (
            <span className="text-xs text-muted-foreground">{sense.info}</span>
          )}
        </div>
      ))}
      {entry.derivationChain !== undefined && entry.derivationChain.length > 0 && (
        <p className="text-xs text-muted-foreground">
          ← {entry.derivationChain.join(' ← ')}
        </p>
      )}
    </div>
  );
}

export function WordPopover({ word, surface, currentFurigana, onClose, onStatusUpdate, onFuriganaEdit }: WordPopoverProps) {
  const { adjustKnownWordCount } = useKnownWordCount();
  const [translationState, setTranslationState] = useState<TranslationState | null>(null);
  const [markingStatus, setMarkingStatus] = useState(false);
  const [furiganaInput, setFuriganaInput] = useState(currentFurigana ?? '');
  const [savingFurigana, setSavingFurigana] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (word.translation !== null || word.user_translation !== null) return;

    setTranslationState({ kind: 'loading' });

    let cancelled = false;
    (async () => {
      try {
        const entry = await lookupWord(word.dictionary_form, word.reading);
        if (cancelled) return;

        if (entry) {
          setTranslationState({ kind: 'jmdict', entry });
          return;
        }

        const res = await fetch(`/api/words/${word.id}/translation`);
        if (cancelled) return;

        if (res.status === 403) {
          setTranslationState({ kind: 'no-api-key' });
          return;
        }
        if (!res.ok) {
          setTranslationState({ kind: 'error' });
          return;
        }
        const data = await res.json();
        setTranslationState({ kind: 'llm', translations: data.translations });
      } catch {
        if (!cancelled) setTranslationState({ kind: 'error' });
      }
    })();

    return () => { cancelled = true; };
  }, [word.id, word.dictionary_form, word.reading, word.translation, word.user_translation]);

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
      if (newStatus === 'known' && word.status !== 'known') adjustKnownWordCount(1);
      else if (word.status === 'known' && newStatus !== 'known') adjustKnownWordCount(-1);
      onStatusUpdate(updated);
    } finally {
      setMarkingStatus(false);
    }
  }

  async function handleSaveFurigana() {
    if (surface === undefined || onFuriganaEdit === undefined) return;
    setSavingFurigana(true);
    await fetch('/api/furigana-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: word.id, surface_form: surface, corrected_reading: furiganaInput }),
    });
    setSavingFurigana(false);
    onFuriganaEdit(surface, furiganaInput);
  }

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
          {word.frequency_tier !== null && (
            <span className="font-en text-[11px]" style={{ color: 'var(--yg-ink-muted)' }}>
              {word.frequency_tier}
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
            {word.user_translation !== null ? (
              <>
                <span role="img" aria-label="Custom translation">✏️</span>
                {' '}{word.user_translation}
              </>
            ) : word.translation !== null ? (
              parseTranslations(word.translation).join(' / ')
            ) : translationState?.kind === 'loading' ? (
              <Spinner />
            ) : translationState?.kind === 'jmdict' ? (
              <JMdictDisplay entry={translationState.entry} />
            ) : translationState?.kind === 'llm' ? (
              translationState.translations.join(' / ')
            ) : translationState?.kind === 'no-api-key' ? (
              <p>Add an OpenRouter key in Settings to look up proper nouns and rare words.</p>
            ) : translationState?.kind === 'error' ? (
              <span style={{ color: 'var(--yg-ink-muted)' }}>No translation available</span>
            ) : null}
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
                ? 'var(--yg-bamboo-dark)'
                : opt.id === 'seen'
                  ? 'var(--yg-coral-dark)'
                  : 'var(--yg-ink)';
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

        {/* Furigana edit */}
        {surface !== undefined && (
          <div>
            <div className="font-en text-[11px] font-semibold tracking-[1.4px] uppercase mb-2" style={{ color: 'var(--yg-ink-muted)' }}>
              Furigana
            </div>
            <div className="flex items-center gap-2">
              <span className="font-jp text-[15px] shrink-0" style={{ color: 'var(--yg-ink-soft)' }}>
                {surface}
              </span>
              <input
                aria-label={`Furigana reading for ${surface}`}
                value={furiganaInput}
                onChange={e => setFuriganaInput(e.target.value)}
                className="flex-1 font-jp text-[14px] rounded-lg px-2.5 py-1.5 border outline-none min-w-0"
                style={{
                  background: 'var(--yg-paper)',
                  borderColor: 'var(--yg-rule)',
                  color: 'var(--yg-ink)',
                }}
              />
              <button
                type="button"
                onClick={() => { void handleSaveFurigana(); }}
                disabled={savingFurigana}
                className="font-en text-[12px] font-medium px-3 py-1.5 rounded-full shrink-0 disabled:opacity-40"
                style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
              >
                {savingFurigana ? '…' : 'Save'}
              </button>
            </div>
          </div>
        )}
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
