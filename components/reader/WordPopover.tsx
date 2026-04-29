'use client';

import { useEffect, useRef, useState } from 'react';
import type { Word } from '@/lib/types';
import { parseTranslations } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

interface WordPopoverProps {
  word: Word;
  onClose: () => void;
  onStatusUpdate: (word: Word) => void;
}

export function WordPopover({ word, onClose, onStatusUpdate }: WordPopoverProps) {
  const [loadedTranslations, setLoadedTranslations] = useState<string[] | null>(null);
  const [translationLoading, setTranslationLoading] = useState(
    word.translation === null && word.user_translation === null,
  );
  const [markingKnown, setMarkingKnown] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (word.translation !== null || word.user_translation !== null) return;
    fetch(`/api/words/${word.id}/translation`)
      .then(r => r.json())
      .then((data: { translations?: string[] }) => {
        if (Array.isArray(data.translations)) {
          setLoadedTranslations(data.translations);
        }
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

  async function handleMarkKnown() {
    setMarkingKnown(true);
    try {
      const res = await fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'known' }),
      });
      const updated: Word = await res.json();
      onStatusUpdate(updated);
      onClose();
    } finally {
      setMarkingKnown(false);
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

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Word details: ${word.dictionary_form}`}
      className="z-50 bg-white border rounded shadow-lg p-3 min-w-[12rem] max-w-xs"
    >
      <div aria-live="polite" aria-atomic="true">
        {translationLoading ? (
          <Spinner />
        ) : word.user_translation !== null ? (
          <>
            <span role="img" aria-label="Custom translation">✏️</span>
            {' '}{word.user_translation}
          </>
        ) : (
          <span>{translationText}</span>
        )}
      </div>
      {word.status === 'seen' && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleMarkKnown}
            disabled={markingKnown}
            className="min-h-11 text-sm bg-green-600 text-white px-3 py-1 rounded"
          >
            Mark as known
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-sm border px-3 py-1 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
