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
  const statusClass = word !== null ? statusToUnderlineClass(word.status) : '';
  const showRt = showFurigana;

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    if (word !== null && onWordClick !== undefined) {
      onWordClick(word, e.currentTarget.getBoundingClientRect());
    }
  }

  const showEditTrigger = isHovered && !isEditing && word !== null && onFuriganaEdit !== undefined;

  return (
    <span
      className="relative inline-block"
      data-word
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <ruby aria-label={reading} className={statusClass} onClick={handleClick}>
        {token.surface}
        <rt aria-hidden="true" className={showRt ? '' : 'hidden'}>{reading}</rt>
      </ruby>
      {showEditTrigger && (
        <button
          type="button"
          aria-label={`Edit furigana for ${token.surface}`}
          data-furigana-edit-trigger
          className="absolute -top-5 right-0 text-xs text-gray-400 hover:text-gray-700 leading-none"
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

function statusToUnderlineClass(status: string): string {
  switch (status) {
    case 'seen': return 'underline decoration-blue-400';
    case 'known': return 'underline decoration-green-400';
    default: return 'underline decoration-gray-300';
  }
}
