import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { WordToken } from '@/components/reader/WordToken';
import { WordPopover } from '@/components/reader/WordPopover';
import type { Token, Word } from '@/lib/types';

const mockToken: Token = {
  surface: '猫',
  dictionary_form: '猫',
  reading: 'ネコ',
  is_content_word: true,
};

const unseenWord: Word = {
  id: 7,
  user_id: 1,
  dictionary_form: '猫',
  reading: 'ネコ',
  status: 'unseen',
  translation: null,
  user_translation: null,
  jlpt_level: null,
  seen_at: null,
  known_at: null,
};

function WordTokenWithPopover({ initialWord }: { initialWord: Word }) {
  const [word, setWord] = useState(initialWord);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  function handleWordClick(clicked: Word, rect: DOMRect) {
    setAnchor(rect);
    if (clicked.status === 'unseen') {
      const advanced: Word = { ...clicked, status: 'seen' };
      setWord(advanced);
      fetch(`/api/words/${clicked.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seen' }),
      }).catch(() => setWord(initialWord));
      setOpen(true);
    } else {
      setOpen(true);
    }
  }

  return (
    <div>
      <WordToken
        token={mockToken}
        word={word}
        furiganaOverride={null}
        showFurigana={true}
        onWordClick={handleWordClick}
      />
      {open && anchor !== null && (
        <WordPopover
          word={word}
          anchorRect={anchor}
          onClose={() => setOpen(false)}
          onStatusUpdate={setWord}
        />
      )}
    </div>
  );
}

describe('WordToken + WordPopover integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('click unseen word → advances status to seen and triggers translation fetch', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...unseenWord, status: 'seen', seen_at: '2024-01-01' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ translations: ['cat'] }), { status: 200 }),
      );

    const { container } = render(<WordTokenWithPopover initialWord={unseenWord} />);
    const ruby = container.querySelector('ruby')!;

    await user.click(ruby);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/words/7',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(ruby).toHaveClass('decoration-blue-400');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/words/7/translation');
    });
  });

  it('on PATCH error → reverts status optimistically', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    const { container } = render(<WordTokenWithPopover initialWord={unseenWord} />);
    const ruby = container.querySelector('ruby')!;

    await user.click(ruby);

    await waitFor(() => {
      expect(ruby).toHaveClass('decoration-gray-300');
    });
  });
});
