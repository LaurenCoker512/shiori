import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordPopover } from '@/components/reader/WordPopover';
import type { Word } from '@/lib/types';

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 1,
    user_id: 1,
    dictionary_form: '猫',
    reading: 'ネコ',
    status: 'unseen',
    translation: '["cat"]',
    user_translation: null,
    jlpt_level: null,
    seen_at: null,
    known_at: null,
    ...overrides,
  };
}

const mockAnchorRect = {
  top: 100, bottom: 120, left: 200, right: 250,
  width: 50, height: 20, x: 200, y: 100,
  toJSON: () => ({}),
} as DOMRect;

describe('WordPopover', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unseen word: shows translation, no "Mark as known" button', () => {
    render(
      <WordPopover
        word={makeWord({ status: 'unseen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as known/i })).not.toBeInTheDocument();
  });

  it('seen word: shows "Mark as known" button and "Close" button', () => {
    render(
      <WordPopover
        word={makeWord({ status: 'seen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /mark as known/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('known word: shows translation, no "Mark as known" button', () => {
    render(
      <WordPopover
        word={makeWord({ status: 'known', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as known/i })).not.toBeInTheDocument();
  });

  it('user_translation set → shown primary with pencil icon aria-label="Custom translation"', () => {
    render(
      <WordPopover
        word={makeWord({ user_translation: 'my cat', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('my cat')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Custom translation' })).toBeInTheDocument();
  });

  it('no user_translation → shows parseTranslations output', () => {
    render(
      <WordPopover
        word={makeWord({ user_translation: null, translation: '["cat","feline"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('cat / feline')).toBeInTheDocument();
  });

  it('aria-live="polite" region present while loading', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('"Mark as known" → calls PATCH /api/words/[id], calls onStatusUpdate', async () => {
    const user = userEvent.setup();
    const onStatusUpdate = vi.fn();
    const onClose = vi.fn();
    const updatedWord = makeWord({ status: 'known', known_at: '2024-01-01' });

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(updatedWord), { status: 200 }),
    );

    render(
      <WordPopover
        word={makeWord({ status: 'seen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={onClose}
        onStatusUpdate={onStatusUpdate}
      />,
    );

    await user.click(screen.getByRole('button', { name: /mark as known/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/words/1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(onStatusUpdate).toHaveBeenCalledWith(updatedWord);
    });
  });

  it('Escape key closes popover', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <WordPopover
        word={makeWord({ translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={onClose}
        onStatusUpdate={vi.fn()}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('click outside closes popover', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <div>
        <button type="button">outside</button>
        <WordPopover
          word={makeWord({ translation: '["cat"]' })}
          anchorRect={mockAnchorRect}
          onClose={onClose}
          onStatusUpdate={vi.fn()}
        />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalled();
  });
});
