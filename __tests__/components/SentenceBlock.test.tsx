import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentenceBlock } from '@/components/reader/SentenceBlock';
import type { Sentence, Word } from '@/lib/types';

const mockToken = {
  surface: 'テスト',
  dictionary_form: 'テスト',
  reading: 'テスト',
  dict_reading: 'テスト',
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

const mockWord: Word = {
  id: 1,
  user_id: 1,
  dictionary_form: 'テスト',
  reading: 'テスト',
  status: 'unseen',
  translation: null,
  user_translation: null,
  jlpt_level: null,
  seen_at: null,
  known_at: null,
};

describe('SentenceBlock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it('clicking non-word area calls onSentenceClick with sentence index', async () => {
    const user = userEvent.setup();
    const onSentenceClick = vi.fn();

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
        onSentenceClick={onSentenceClick}
      />,
    );

    const paragraph = container.querySelector('p')!;
    await user.click(paragraph);

    expect(onSentenceClick).toHaveBeenCalledWith(1);
  });

  it('clicking non-word area does not call onSentenceClick when not provided', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
      />,
    );

    // Should not throw when onSentenceClick is undefined
    await user.click(container.querySelector('p')!);
  });

  it('isActiveGrammarSentence=true suppresses onSentenceClick on p click', async () => {
    const user = userEvent.setup();
    const onSentenceClick = vi.fn();

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
        onSentenceClick={onSentenceClick}
        isActiveGrammarSentence={true}
      />,
    );

    await user.click(container.querySelector('p')!);
    expect(onSentenceClick).not.toHaveBeenCalled();
  });

  it('clicking [data-word] child does not call onSentenceClick', async () => {
    const user = userEvent.setup();
    const onSentenceClick = vi.fn();

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{ 'テスト|テスト': mockWord }}
        furiganaOverrides={{}}
        showFurigana={true}
        onSentenceClick={onSentenceClick}
      />,
    );

    const wordEl = container.querySelector('[data-word]')!;
    await user.click(wordEl);

    expect(onSentenceClick).not.toHaveBeenCalled();
  });

});
