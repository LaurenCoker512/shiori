import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordBrowser } from '@/components/dashboard/WordBrowser';
import type { Word } from '@/lib/types';

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 1,
    user_id: 1,
    dictionary_form: '猫',
    reading: 'ねこ',
    status: 'seen',
    translation: '["cat"]',
    user_translation: null,
    jlpt_level: 'N5',
    seen_at: '2024-01-01',
    known_at: null,
    ...overrides,
  };
}

function mockFetch(words: Word[], total: number) {
  vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response(
      JSON.stringify({ words, total, knownCount: 0, seenCount: words.length, unseenCount: 0 }),
      { status: 200 },
    )),
  );
}

describe('WordBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches words on mount and renders them', async () => {
    mockFetch([makeWord()], 1);

    render(<WordBrowser />);

    await waitFor(() => {
      expect(screen.getByText('猫')).toBeInTheDocument();
    });
  });

  it('search input debounced 300ms before fetch (fake timers)', async () => {
    vi.useFakeTimers();
    mockFetch([], 0);

    render(<WordBrowser />);

    // Resolve the mount fetch
    await act(async () => { vi.runAllTimers(); });

    const fetchCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    const input = screen.getByLabelText('Search words');

    await act(async () => {
      fireEvent.change(input, { target: { value: '猫' } });
    });

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCallCount);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search='));
    vi.useRealTimers();
  });

  it('status filter button click triggers refetch with updated status param', async () => {
    const user = userEvent.setup();
    mockFetch([], 0);

    render(<WordBrowser />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /^seen$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=seen'));
    });
  });

  it('JLPT dropdown change triggers refetch', async () => {
    const user = userEvent.setup();
    mockFetch([], 0);

    render(<WordBrowser />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await user.selectOptions(screen.getByLabelText('Filter by JLPT level'), 'N3');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('jlpt_level=N3'));
    });
  });

  it('pagination previous button disabled on first page', async () => {
    mockFetch([makeWord()], 50);

    render(<WordBrowser />);

    await waitFor(() => {
      expect(screen.getByText('猫')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('inline pencil click reveals user_translation input; blur saves via PATCH', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(
          JSON.stringify({ words: [makeWord()], total: 1, knownCount: 0, seenCount: 1, unseenCount: 0 }),
          { status: 200 },
        )),
      )
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
      );

    render(<WordBrowser />);

    await waitFor(() => {
      expect(screen.getByLabelText('Edit translation for 猫')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Edit translation for 猫'));
    expect(screen.getByRole('textbox', { name: /edit translation for 猫/i })).toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /edit translation for 猫/i });
    await user.clear(input);
    await user.type(input, 'kitty');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/words/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ user_translation: 'kitty' }),
        }),
      );
    });
  });

  it('look up button appears for words with no translation; clicking fetches and renders gloss', async () => {
    const user = userEvent.setup();
    const untranslated = makeWord({ translation: null });
    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(
          JSON.stringify({ words: [untranslated], total: 1, knownCount: 0, seenCount: 1, unseenCount: 0 }),
          { status: 200 },
        )),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(
          JSON.stringify({ translations: ['cat', 'kitty cat'], jlpt_level: 'N5' }),
          { status: 200 },
        )),
      );

    render(<WordBrowser />);

    await waitFor(() => {
      expect(screen.getByLabelText('Look up translation for 猫')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Look up translation for 猫'));

    await waitFor(() => {
      expect(screen.getByText('cat; kitty cat')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/words/1/translation');
  });

  it('user_translation shown primary when set; Claude gloss shown below in muted text', async () => {
    const word = makeWord({ user_translation: 'kitty', translation: '["cat","feline"]' });
    mockFetch([word], 1);

    render(<WordBrowser />);

    await waitFor(() => {
      expect(screen.getByText('kitty')).toBeInTheDocument();
    });

    const gloss = screen.getByText('cat; feline');
    expect(gloss).toHaveClass('text-gray-500');
  });
});
