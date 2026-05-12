'use client';

import type { Sentence, Word } from '@/lib/types';
import { WordToken } from './WordToken';

const HEADING_FONT = "var(--reader-jp-font, var(--font-zen-mincho)), 'Yu Mincho', serif";

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5H1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2l4 3V2.5L3 5.5z" />
      <path d="M11.5 8a3.5 3.5 0 0 0-2-3.15v6.3A3.5 3.5 0 0 0 11.5 8z" />
      <path d="M13.5 3.5a7 7 0 0 1 0 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

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
  isActiveGrammarSentence?: boolean;
  isActiveTTS?: boolean;
  onPlaySentence?: () => void;
  ttsEnabled?: boolean;
}

export function SentenceBlock({
  sentence,
  wordStatusMap,
  furiganaOverrides,
  showFurigana,
  onWordClick,
  onSentenceClick,
  isActiveGrammarSentence,
  isActiveTTS,
  onPlaySentence,
  ttsEnabled,
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
    if (isActiveGrammarSentence === true) return;
    onSentenceClick?.(sentence.sentence_index);
  }

  return (
    <div
      className="group relative my-[0.7em]"
      style={isActiveTTS === true ? { borderLeft: '2px solid var(--yg-known)', paddingLeft: '0.35em' } : undefined}
    >
      {ttsEnabled === true && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlaySentence?.(); e.currentTarget.blur(); }}
          className={`absolute top-[0.9em] left-[-1.8em] transition-opacity ${isActiveTTS === true ? 'opacity-70' : 'opacity-0 group-hover:opacity-50 focus:opacity-70'} hover:!opacity-100`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yg-ink-soft)', padding: '2px 4px', lineHeight: 1 }}
          aria-label={`Play from sentence ${sentence.sentence_index + 1}`}
        >
          <SpeakerIcon />
        </button>
      )}
      <p
        className="cursor-default"
        style={{ textIndent: '1em' }}
        onClick={handleClick}
      >
        {tokens}
      </p>
    </div>
  );
}
