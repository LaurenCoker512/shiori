'use client';

import type { Sentence, Word } from '@/lib/types';
import { WordToken } from './WordToken';

const HEADING_FONT = "var(--reader-jp-font, var(--font-zen-mincho)), 'Yu Mincho', serif";

const HEADING_STYLES: Record<string, React.CSSProperties> = {
  h1: { fontSize: '2rem',  fontWeight: 500, margin: '1.2em 0 0.6em', letterSpacing: '-0.3px', fontFamily: HEADING_FONT },
  h2: { fontSize: '1.6rem', fontWeight: 500, margin: '1.1em 0 0.5em', fontFamily: HEADING_FONT },
  h3: { fontSize: '1.3rem', fontWeight: 500, margin: '1em 0 0.4em',   fontFamily: HEADING_FONT },
  h4: { fontSize: '1.1rem', fontWeight: 500, margin: '0.9em 0 0.3em', fontFamily: HEADING_FONT },
  h5: { fontSize: '1rem',   fontWeight: 600, margin: '0.8em 0 0.2em', fontFamily: HEADING_FONT },
  h6: { fontSize: '0.9rem', fontWeight: 600, margin: '0.7em 0 0.2em', fontFamily: HEADING_FONT },
};

interface SentenceBlockProps {
  sentence: Sentence;
  wordStatusMap: Record<string, Word>;
  furiganaOverrides: Record<string, string>;
  showFurigana: boolean;
  onWordClick?: (word: Word, surface: string, furigana: string, anchor: DOMRect) => void;
  onSentenceClick?: (sentenceIndex: number) => void;
  grammarPhase?: 'prompt' | 'showing' | null;
  onGrammarConfirm?: () => void;
  onGrammarCancel?: () => void;
}

export function SentenceBlock({
  sentence,
  wordStatusMap,
  furiganaOverrides,
  showFurigana,
  onWordClick,
  onSentenceClick,
  grammarPhase,
  onGrammarConfirm,
  onGrammarCancel,
}: SentenceBlockProps) {
  const tokens = sentence.tokens.map((token, i) => (
    <WordToken
      key={i}
      token={token}
      word={wordStatusMap[`${token.dictionary_form}|${token.dict_reading}`] ?? null}
      furiganaOverride={furiganaOverrides[token.surface] ?? null}
      showFurigana={showFurigana}
      onWordClick={onWordClick}
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

  function handleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-word]') !== null) return;
    if (grammarPhase === 'showing' || grammarPhase === 'prompt') return;
    onSentenceClick?.(sentence.sentence_index);
  }

  return (
    <p
      className="my-[0.7em] cursor-default"
      style={{ textIndent: '1em' }}
      onClick={handleClick}
    >
      {tokens}
      {grammarPhase === 'prompt' && (
        <span className="block mt-1.5 font-en text-xs" style={{ color: 'var(--yg-ink-soft)' }}>
          Analyze grammar for this sentence?
          <button
            className="ml-2 font-en text-xs"
            style={{ color: 'var(--yg-bamboo-dark)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onGrammarConfirm?.(); }}
          >
            Analyze
          </button>
          <button
            className="ml-2 font-en text-xs"
            style={{ color: 'var(--yg-ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onGrammarCancel?.(); }}
          >
            Cancel
          </button>
        </span>
      )}
    </p>
  );
}
