'use client';

import { useState, useEffect } from 'react';
import type { ParsedContent, Word, FuriganaOverride } from '@/lib/types';
import { SentenceBlock } from './SentenceBlock';

interface ReaderContentProps {
  content: ParsedContent;
  wordStatusMap: Record<string, Word>;
  furiganaOverrides: FuriganaOverride[];
}

export function ReaderContent({ content, wordStatusMap, furiganaOverrides }: ReaderContentProps) {
  const [showFurigana, setShowFurigana] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('shiori-furigana');
    if (stored !== null) setShowFurigana(stored === 'true');
  }, []);

  function toggleFurigana() {
    const next = !showFurigana;
    setShowFurigana(next);
    localStorage.setItem('shiori-furigana', String(next));
  }

  const overrideMap: Record<string, string> = {};
  for (const override of furiganaOverrides) {
    overrideMap[override.surface_form] = override.corrected_reading;
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
            wordStatusMap={wordStatusMap}
            furiganaOverrides={overrideMap}
            showFurigana={showFurigana}
          />
        ))}
      </div>
    </div>
  );
}
