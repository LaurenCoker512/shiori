'use client';

import { useState } from 'react';
import type { Token, Word } from '@/lib/types';
import { FuriganaEdit } from './FuriganaEdit';

interface WordTokenProps {
  token: Token;
  word: Word | null;
  furiganaOverride: string | null;
  showFurigana: boolean;
  onWordClick?: (word: Word, anchor: DOMRect) => void;
  onFuriganaEdit?: (surface: string, newReading: string) => void;
}

export function WordToken({ token, word, furiganaOverride, showFurigana, onWordClick, onFuriganaEdit }: WordTokenProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!token.is_content_word) {
    return <span>{token.surface}</span>;
  }

  const reading = furiganaOverride ?? token.reading;
  const status = word?.status;
  const showEditTrigger = isHovered && !isEditing && word !== null && onFuriganaEdit !== undefined;

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    if (word !== null && onWordClick !== undefined) {
      onWordClick(word, e.currentTarget.getBoundingClientRect());
    }
  }

  const tintStyle: React.CSSProperties = status === 'seen'
    ? { background: 'var(--yg-seen)', borderBottom: '1px solid transparent' }
    : status === 'known'
      ? { background: 'var(--yg-known)', borderBottom: '1px solid transparent' }
      : { borderBottom: '1.5px dotted var(--yg-coral)' };

  return (
    <span
      className="relative inline"
      data-word
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <ruby
        aria-label={reading}
        data-status={status ?? 'unseen'}
        style={{
          ...tintStyle,
          display: 'inline',
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
          className={showFurigana ? '' : 'hidden'}
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
      {showEditTrigger && (
        <button
          type="button"
          aria-label={`Edit furigana for ${token.surface}`}
          data-furigana-edit-trigger
          className="absolute -top-5 right-0 text-xs leading-none"
          style={{ color: 'var(--yg-ink-muted)' }}
          onClick={() => setIsEditing(true)}
        >
          ✎
        </button>
      )}
      {isEditing && word !== null && (
        <FuriganaEdit
          wordId={word.id}
          surfaceForm={token.surface}
          currentReading={reading}
          onSave={(newReading) => {
            setIsEditing(false);
            setIsHovered(false);
            if (onFuriganaEdit !== undefined) onFuriganaEdit(token.surface, newReading);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </span>
  );
}
