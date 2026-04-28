'use client';

import type { Sentence, Word } from '@/lib/types';
import { WordToken } from './WordToken';

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
  onWordClick?: (word: Word) => void;
}

export function SentenceBlock({
  sentence,
  wordStatusMap,
  furiganaOverrides,
  showFurigana,
  onWordClick,
}: SentenceBlockProps) {
  const tokens = sentence.tokens.map((token, i) => (
    <WordToken
      key={i}
      token={token}
      word={wordStatusMap[`${token.dictionary_form}|${token.reading}`] ?? null}
      furiganaOverride={furiganaOverrides[token.surface] ?? null}
      showFurigana={showFurigana}
      onWordClick={onWordClick}
    />
  ));

  if (sentence.is_heading === true) {
    const tag = `h${sentence.heading_level ?? 1}` as keyof typeof HEADING_CLASSES;
    const Tag = tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return <Tag className={HEADING_CLASSES[tag]}>{tokens}</Tag>;
  }

  function handlePointerEvent(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-word]') !== null) return;
    // grammar trigger — wired in Phase 17
  }

  return (
    <p
      className="my-2 leading-loose"
      data-grammar-trigger
      onPointerEnter={handlePointerEvent}
    >
      {tokens}
    </p>
  );
}
