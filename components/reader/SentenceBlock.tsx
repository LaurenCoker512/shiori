'use client';

import { useState } from 'react';
import type { Sentence, Word, GrammarPattern } from '@/lib/types';
import { WordToken } from './WordToken';
import { GrammarTooltip } from './GrammarTooltip';

const HEADING_STYLES: Record<string, React.CSSProperties> = {
  h1: { fontSize: '2rem',  fontWeight: 500, margin: '1.2em 0 0.6em', letterSpacing: '-0.3px' },
  h2: { fontSize: '1.6rem', fontWeight: 500, margin: '1.1em 0 0.5em' },
  h3: { fontSize: '1.3rem', fontWeight: 500, margin: '1em 0 0.4em' },
  h4: { fontSize: '1.1rem', fontWeight: 500, margin: '0.9em 0 0.3em' },
  h5: { fontSize: '1rem',   fontWeight: 600, margin: '0.8em 0 0.2em' },
  h6: { fontSize: '0.9rem', fontWeight: 600, margin: '0.7em 0 0.2em' },
};

interface SentenceBlockProps {
  sentence: Sentence;
  wordStatusMap: Record<string, Word>;
  furiganaOverrides: Record<string, string>;
  showFurigana: boolean;
  onWordClick?: (word: Word, anchor: DOMRect) => void;
  onFuriganaEdit?: (surface: string, newReading: string) => void;
  textId: number;
}

type GrammarState = 'idle' | 'prompt' | 'showing' | 'hidden';

export function SentenceBlock({
  sentence,
  wordStatusMap,
  furiganaOverrides,
  showFurigana,
  onWordClick,
  onFuriganaEdit,
  textId,
}: SentenceBlockProps) {
  const [grammarState, setGrammarState] = useState<GrammarState>('idle');
  const [cachedPatterns, setCachedPatterns] = useState<GrammarPattern[] | null>(null);

  const tokens = sentence.tokens.map((token, i) => (
    <WordToken
      key={i}
      token={token}
      word={wordStatusMap[`${token.dictionary_form}|${token.reading}`] ?? null}
      furiganaOverride={furiganaOverrides[token.surface] ?? null}
      showFurigana={showFurigana}
      onWordClick={onWordClick}
      onFuriganaEdit={onFuriganaEdit}
    />
  ));

  if (sentence.is_heading === true) {
    const tag = `h${sentence.heading_level ?? 1}`;
    const Tag = tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return (
      <Tag style={{ ...HEADING_STYLES[tag], color: 'var(--yg-ink)', fontFamily: 'var(--font-zen-mincho)' }}>
        {tokens}
      </Tag>
    );
  }

  function handleSentenceClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-word]') !== null) return;
    if (grammarState === 'showing' || grammarState === 'prompt') return;
    setGrammarState('prompt');
  }

  function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    setGrammarState('showing');
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setGrammarState(cachedPatterns !== null ? 'hidden' : 'idle');
  }

  return (
    <p
      className="my-[0.7em] cursor-default"
      style={{ textIndent: '1em' }}
      data-grammar-trigger
      onClick={handleSentenceClick}
    >
      {tokens}
      {grammarState === 'prompt' && (
        <span className="block mt-1.5 font-en text-xs" style={{ color: 'var(--yg-ink-soft)' }}>
          {cachedPatterns !== null ? 'Show grammar analysis?' : 'Analyze grammar for this sentence?'}
          <button
            className="ml-2 font-en text-xs"
            style={{ color: 'var(--yg-bamboo-dark)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={handleConfirm}
          >
            {cachedPatterns !== null ? 'Show' : 'Analyze'}
          </button>
          <button
            className="ml-2 font-en text-xs"
            style={{ color: 'var(--yg-ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </span>
      )}
      {grammarState === 'showing' && (
        <GrammarTooltip
          textId={textId}
          sentenceIndex={sentence.sentence_index}
          initialPatterns={cachedPatterns}
          onPatternsLoaded={setCachedPatterns}
          onClose={() => setGrammarState('hidden')}
        />
      )}
    </p>
  );
}
