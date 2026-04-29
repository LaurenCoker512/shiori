import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('WordBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('search input debounced 300ms before fetch (fake timers)', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ words: [], total: 0 }), { status: 200 }),
    );

    render(<WordBrowser />);
    const input = screen.getByLabelText('Search words');

    await act(async () => {
      fireEvent.change(input, { target: { value: '猫' } });
    });

    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search='));
    vi.useRealTimers();
  });

  it('status dropdown change triggers refetch with updated status param', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ words: [], total: 0 }), { status: 200 }),
    );

    render(<WordBrowser />);
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'seen');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=seen'));
    });
  });

  it('JLPT dropdown change triggers refetch', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ words: [], total: 0 }), { status: 200 }),
    );

    render(<WordBrowser />);
    await user.selectOptions(screen.getByLabelText('Filter by JLPT level'), 'N3');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('jlpt_level=N3'));
    });
  });

  it('pagination buttons disabled at first/last page', () => {
    render(<WordBrowser initialWords={[makeWord()]} initialTotal={50} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('inline pencil click reveals user_translation input; blur saves via PATCH', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    render(<WordBrowser initialWords={[makeWord()]} initialTotal={1} />);

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

  it('user_translation shown primary when set; Claude gloss shown below in muted text', () => {
    const word = makeWord({ user_translation: 'kitty', translation: '["cat","feline"]' });
    render(<WordBrowser initialWords={[word]} initialTotal={1} />);

    expect(screen.getByText('kitty')).toBeInTheDocument();
    const gloss = screen.getByText('cat; feline');
    expect(gloss).toHaveClass('text-gray-400');
  });
});
