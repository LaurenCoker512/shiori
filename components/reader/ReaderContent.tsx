'use client';

import { useState, useEffect } from 'react';
import type { ParsedContent, Word, FuriganaOverride } from '@/lib/types';
import { SentenceBlock } from './SentenceBlock';
import { WordPopover } from './WordPopover';

interface ReaderContentProps {
  content: ParsedContent;
  wordStatusMap: Record<string, Word>;
  furiganaOverrides: FuriganaOverride[];
  textId: number;
}

export function ReaderContent({ content, wordStatusMap, furiganaOverrides, textId }: ReaderContentProps) {
  const [showFurigana, setShowFurigana] = useState(true);
  const [wordMap, setWordMap] = useState<Record<string, Word>>(wordStatusMap);
  const [popoverWord, setPopoverWord] = useState<Word | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [overrideMap, setOverrideMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const override of furiganaOverrides) {
      map[override.surface_form] = override.corrected_reading;
    }
    return map;
  });

  useEffect(() => {
    const stored = localStorage.getItem('shiori-furigana');
    if (stored !== null) setShowFurigana(stored === 'true');
  }, []);

  function toggleFurigana() {
    const next = !showFurigana;
    setShowFurigana(next);
    localStorage.setItem('shiori-furigana', String(next));
  }

  function wordKey(word: Word): string {
    return `${word.dictionary_form}|${word.reading}`;
  }

  function handleWordClick(word: Word, anchor: DOMRect) {
    const key = wordKey(word);
    const originalWord = wordMap[key] ?? word;

    setPopoverAnchor(anchor);
    if (word.status === 'unseen') {
      const advanced: Word = { ...word, status: 'seen' };
      setWordMap(prev => ({ ...prev, [key]: advanced }));
      fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seen' }),
      }).catch(() => {
        setWordMap(prev => ({ ...prev, [key]: originalWord }));
      });
      setPopoverWord(advanced);
    } else {
      setPopoverWord(word);
    }
  }

  function handleStatusUpdate(updated: Word) {
    setWordMap(prev => ({ ...prev, [wordKey(updated)]: updated }));
  }

  function handleFuriganaEdit(surface: string, newReading: string) {
    setOverrideMap(prev => ({ ...prev, [surface]: newReading }));
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-end mb-5">
        <button
          type="button"
          onClick={toggleFurigana}
          className="font-en text-[12px] font-medium min-h-11 px-4 rounded-full border inline-flex items-center transition-all"
          style={{
            background: 'var(--yg-paper-hi)',
            borderColor: 'var(--yg-rule)',
            color: 'var(--yg-ink-soft)',
          }}
        >
          {showFurigana ? 'Hide furigana' : 'Show furigana'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 font-en text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--yg-known)' }} aria-hidden="true" />
          Known
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--yg-seen)' }} aria-hidden="true" />
          Seen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ border: '1.5px dotted var(--yg-coral)' }}
            aria-hidden="true"
          />
          New
        </span>
      </div>

      {/* Text body */}
      <div
        className="font-jp leading-[2.6] text-[18px] tracking-[0.02em]"
        style={{ color: 'var(--yg-ink)' }}
      >
        {content.map((sentence, i) => (
          <SentenceBlock
            key={i}
            sentence={sentence}
            wordStatusMap={wordMap}
            furiganaOverrides={overrideMap}
            showFurigana={showFurigana}
            onWordClick={handleWordClick}
            onFuriganaEdit={handleFuriganaEdit}
            textId={textId}
          />
        ))}
      </div>

      {/* End ornament */}
      <div className="flex items-center justify-center gap-3.5 mt-10 mb-3">
        <span className="flex-1 h-px max-w-[80px]" style={{ background: 'var(--yg-rule)' }} />
        <span className="font-jp text-sm tracking-[6px]" style={{ color: 'var(--yg-coral)' }}>· · ·</span>
        <span className="flex-1 h-px max-w-[80px]" style={{ background: 'var(--yg-rule)' }} />
      </div>

      {popoverWord !== null && popoverAnchor !== null && (
        <WordPopover
          word={popoverWord}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverWord(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}
