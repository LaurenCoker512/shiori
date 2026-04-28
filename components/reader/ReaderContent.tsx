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

  function handleWordClick(word: Word) {
    const key = wordKey(word);
    const originalWord = wordMap[key] ?? word;

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
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={toggleFurigana}
          className="text-sm text-blue-600 underline"
        >
          {showFurigana ? 'Hide furigana' : 'Show furigana'}
        </button>
      </div>
      <div className="leading-loose">
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
      {popoverWord !== null && (
        <WordPopover
          word={popoverWord}
          onClose={() => setPopoverWord(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}
