import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentenceBlock } from '@/components/reader/SentenceBlock';
import type { Sentence } from '@/lib/types';

const mockToken = {
  surface: 'テスト',
  dictionary_form: 'テスト',
  reading: 'テスト',
  pos: 'noun',
  is_content_word: true,
};

const headingSentence: Sentence = {
  sentence_index: 0,
  raw: 'テスト',
  tokens: [mockToken],
  is_heading: true,
  heading_level: 2,
};

const bodySentence: Sentence = {
  sentence_index: 1,
  raw: 'テスト',
  tokens: [mockToken],
};

describe('SentenceBlock', () => {
  it('is_heading: true, heading_level: 2 renders <h2>', () => {
    render(
      <SentenceBlock
        sentence={headingSentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('non-heading sentence renders <p>', () => {
    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
      />,
    );
    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('heading sentence has no grammar trigger', () => {
    const { container } = render(
      <SentenceBlock
        sentence={headingSentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
      />,
    );
    expect(container.querySelector('[data-grammar-trigger]')).not.toBeInTheDocument();
  });
});
