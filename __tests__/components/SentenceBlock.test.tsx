import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentenceBlock } from '@/components/reader/SentenceBlock';
import type { Sentence, Word } from '@/lib/types';

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
        textId={1}
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
        textId={1}
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
        textId={1}
      />,
    );
    expect(container.querySelector('[data-grammar-trigger]')).not.toBeInTheDocument();
  });

  it('pointer on sentence container triggers grammar analysis', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [] }), { status: 200 }),
    );

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{}}
        furiganaOverrides={{}}
        showFurigana={true}
        textId={1}
      />,
    );

    const paragraph = container.querySelector('[data-grammar-trigger]')!;
    await user.pointer({ target: paragraph });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/sentences/1/1/grammar');
    });
  });

  it('pointer on [data-word] child does not trigger grammar analysis', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [] }), { status: 200 }),
    );

    const { container } = render(
      <SentenceBlock
        sentence={bodySentence}
        wordStatusMap={{ 'テスト|テスト': mockWord }}
        furiganaOverrides={{}}
        showFurigana={true}
        textId={1}
      />,
    );

    const wordEl = container.querySelector('[data-word]')!;
    await user.pointer({ target: wordEl });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
