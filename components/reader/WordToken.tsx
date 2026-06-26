'use client';

import type { Token, Word } from '@/lib/types';

interface WordTokenProps {
  token: Token;
  word: Word | null;
  furiganaOverride: string | null;
  showFurigana: boolean;
  onWordClick?: (word: Word, surface: string, furigana: string, anchor: DOMRect) => void;
}

const HAS_JAPANESE = /[ぁ-んァ-ン一-鿿㐀-䶿]/;

export function WordToken({ token, word, furiganaOverride, showFurigana, onWordClick }: WordTokenProps) {
  if (!token.is_content_word || !HAS_JAPANESE.test(token.dictionary_form)) {
    return <span>{token.surface}</span>;
  }

  const reading = furiganaOverride ?? token.reading;
  const status = word?.status;

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    if (word !== null && onWordClick !== undefined) {
      onWordClick(word, token.surface, reading, e.currentTarget.getBoundingClientRect());
    }
  }

  const tintStyle: React.CSSProperties = status === 'seen'
    ? { background: 'var(--yg-seen)', borderBottom: '1px solid transparent' }
    : status === 'known'
      ? {}
      : { background: 'var(--yg-known)', borderBottom: '1px solid transparent' };

  return (
    <span
      className="relative inline"
      data-word
    >
      <ruby
        aria-label={reading}
        data-status={status ?? 'unseen'}
        style={{
          ...tintStyle,
          padding: '0 2px',
          margin: '0 -2px',
          borderRadius: 4,
          cursor: word !== null ? 'pointer' : 'default',
          transition: 'background 0.15s',
        }}
        onClick={handleClick}
      >
        {token.surface}
        <rt
          aria-hidden="true"
          className={showFurigana && status !== 'known' ? '' : 'hidden'}
          style={{
            fontSize: '0.42em',
            fontFamily: 'var(--font-zen-mincho), serif',
            fontWeight: 400,
            letterSpacing: '0.4px',
            color: 'var(--yg-ink-muted)',
            userSelect: 'none',
          }}
        >
          {reading}
        </rt>
      </ruby>
    </span>
  );
}
