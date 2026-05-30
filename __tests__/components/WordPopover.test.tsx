import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordPopover } from '@/components/reader/WordPopover';
import { KnownWordCountProvider } from '@/components/ui/KnownWordCountContext';
import { lookupWord } from '@/lib/jmdict';
import type { Word } from '@/lib/types';

vi.mock('@/lib/jmdict', () => ({
  lookupWord: vi.fn(),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <KnownWordCountProvider initialCount={0}>{ui}</KnownWordCountProvider>,
  );
}

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
    frequency_tier: null,
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

  it('shows translation text', () => {
    renderWithProvider(
      <WordPopover
        word={makeWord({ status: 'unseen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('cat')).toBeInTheDocument();
  });

  it('shows three status buttons: New, Seen, Known', () => {
    renderWithProvider(
      <WordPopover
        word={makeWord({ status: 'seen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /seen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /known/i })).toBeInTheDocument();
  });

  it('known word: shows translation, status buttons present', () => {
    renderWithProvider(
      <WordPopover
        word={makeWord({ status: 'known', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /known/i })).toBeInTheDocument();
  });

  it('user_translation set → shown primary with pencil icon aria-label="Custom translation"', () => {
    renderWithProvider(
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
    renderWithProvider(
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
    vi.mocked(lookupWord).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('clicking Known button → calls PATCH /api/words/[id] with status known, calls onStatusUpdate', async () => {
    const user = userEvent.setup();
    const onStatusUpdate = vi.fn();
    const updatedWord = makeWord({ status: 'known', known_at: '2024-01-01' });

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(updatedWord), { status: 200 }),
    );

    renderWithProvider(
      <WordPopover
        word={makeWord({ status: 'seen', translation: '["cat"]' })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={onStatusUpdate}
      />,
    );

    await user.click(screen.getByRole('button', { name: /known/i }));

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
    renderWithProvider(
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
    renderWithProvider(
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

  it('JMdict hit with single POS → flat gloss list', async () => {
    vi.mocked(lookupWord).mockResolvedValue({
      id: 1,
      jlpt_level: 'N5',
      canonicalForm: '猫',
      senses: [{ pos: ['n'], glosses: ['cat', 'feline'], info: undefined }],
    });
    renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('cat; feline')).toBeInTheDocument());
    expect(screen.queryByText('n')).not.toBeInTheDocument();
  });

  it('JMdict hit with multiple POS → labeled sections', async () => {
    vi.mocked(lookupWord).mockResolvedValue({
      id: 2,
      jlpt_level: null,
      canonicalForm: '上',
      senses: [
        { pos: ['n'], glosses: ['upper', 'top'] },
        { pos: ['v1'], glosses: ['to go up'] },
      ],
    });
    renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('n')).toBeInTheDocument());
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('JMdict miss → fetch called on LLM route; translations rendered', async () => {
    vi.mocked(lookupWord).mockResolvedValue(null);
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ translations: ['cat'] }), { status: 200 }),
    );
    renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('cat')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/words/'));
  });

  it('deinflected result → derivation chain note rendered', async () => {
    vi.mocked(lookupWord).mockResolvedValue({
      id: 3,
      jlpt_level: null,
      canonicalForm: '食べる',
      senses: [{ pos: ['v1'], glosses: ['to eat'] }],
      derivationChain: ['passive', 'polite', 'past'],
    });
    renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('← passive ← polite ← past')).toBeInTheDocument(),
    );
  });

  it('LLM route returns 403 → no-api-key message shown', async () => {
    vi.mocked(lookupWord).mockResolvedValue(null);
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 403 }));
    renderWithProvider(
      <WordPopover
        word={makeWord({ translation: null, user_translation: null })}
        anchorRect={mockAnchorRect}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Add an OpenRouter key/)).toBeInTheDocument(),
    );
  });
});
