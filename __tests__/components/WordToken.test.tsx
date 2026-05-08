import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordToken } from '@/components/reader/WordToken';
import type { Token, Word } from '@/lib/types';

const contentToken: Token = {
  surface: '猫',
  dictionary_form: '猫',
  reading: 'ネコ',
  is_content_word: true,
};

const nonContentToken: Token = {
  surface: 'は',
  dictionary_form: 'は',
  reading: 'は',
  is_content_word: false,
};

function makeWord(status: Word['status']): Word {
  return {
    id: 1,
    user_id: 1,
    dictionary_form: '猫',
    reading: 'ネコ',
    status,
    translation: null,
    user_translation: null,
    jlpt_level: null,
    seen_at: null,
    known_at: null,
  };
}

describe('WordToken', () => {
  it('non-content word renders plain <span>, no <ruby>', () => {
    const { container } = render(
      <WordToken token={nonContentToken} word={null} furiganaOverride={null} showFurigana={true} />,
    );
    expect(container.querySelector('span')).toBeInTheDocument();
    expect(container.querySelector('ruby')).not.toBeInTheDocument();
  });

  it('content word renders <ruby> with aria-label', () => {
    render(
      <WordToken token={contentToken} word={null} furiganaOverride={null} showFurigana={true} />,
    );
    const ruby = document.querySelector('ruby');
    expect(ruby).toBeInTheDocument();
    expect(ruby).toHaveAttribute('aria-label', 'ネコ');
  });

  it('<rt> has aria-hidden="true"', () => {
    const { container } = render(
      <WordToken token={contentToken} word={null} furiganaOverride={null} showFurigana={true} />,
    );
    const rt = container.querySelector('rt');
    expect(rt).toHaveAttribute('aria-hidden', 'true');
  });

  it('known word + showFurigana false → <rt> has hidden class', () => {
    const { container } = render(
      <WordToken token={contentToken} word={makeWord('known')} furiganaOverride={null} showFurigana={false} />,
    );
    expect(container.querySelector('rt')).toHaveClass('hidden');
  });

  it('unseen word + showFurigana false → <rt> hidden', () => {
    const { container } = render(
      <WordToken token={contentToken} word={makeWord('unseen')} furiganaOverride={null} showFurigana={false} />,
    );
    expect(container.querySelector('rt')).toHaveClass('hidden');
  });

  it('known word + showFurigana true → <rt> visible', () => {
    const { container } = render(
      <WordToken token={contentToken} word={makeWord('known')} furiganaOverride={null} showFurigana={true} />,
    );
    expect(container.querySelector('rt')).not.toHaveClass('hidden');
  });

  it('furigana override applied when provided', () => {
    const { container } = render(
      <WordToken token={contentToken} word={null} furiganaOverride="ねこ" showFurigana={true} />,
    );
    expect(container.querySelector('ruby')).toHaveAttribute('aria-label', 'ねこ');
    expect(container.querySelector('rt')).toHaveTextContent('ねこ');
  });
});
