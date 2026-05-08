'use client';

import { useState } from 'react';
import type { Sentence, Word, GrammarPattern } from '@/lib/types';
import { WordToken } from './WordToken';
import { GrammarTooltip } from './GrammarTooltip';

const HEADING_CLASSES: Record<string, string> = {
  h1: 'text-3xl font-bold my-4',
  h2: 'text-2xl font-bold my-3',
  h3: 'text-xl font-bold my-2',
  h4: 'text-lg font-semibold my-2',
  h5: 'text-base font-semibold my-1',
  h6: 'text-sm font-semibold my-1',
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
    const tag = `h${sentence.heading_level ?? 1}` as keyof typeof HEADING_CLASSES;
    const Tag = tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return <Tag className={HEADING_CLASSES[tag]}>{tokens}</Tag>;
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
      className="my-2 leading-loose cursor-default"
      data-grammar-trigger
      onClick={handleSentenceClick}
    >
      {tokens}
      {grammarState === 'prompt' && (
        <span className="block mt-1 text-sm text-gray-600">
          {cachedPatterns !== null ? 'Show grammar analysis?' : 'Analyze grammar for this sentence?'}
          <button
            className="ml-2 text-blue-600 hover:underline"
            onClick={handleConfirm}
          >
            {cachedPatterns !== null ? 'Show' : 'Analyze'}
          </button>
          <button
            className="ml-2 text-gray-400 hover:underline"
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
