import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrammarTooltip } from '@/components/reader/GrammarTooltip';
import type { GrammarPattern } from '@/lib/types';

const mockPattern: GrammarPattern = {
  id: 1,
  pattern: 'が好き',
  description_en: 'Expresses liking something',
  jlpt_level: 'N5',
  first_encountered_at: '2024-01-01',
};

describe('GrammarTooltip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows spinner while fetch is in flight', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<GrammarTooltip textId={1} sentenceIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('on success: renders pattern name, JLPT badge, and description_en', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [mockPattern] }), { status: 200 }),
    );
    render(<GrammarTooltip textId={1} sentenceIndex={0} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('が好き')).toBeInTheDocument();
    });
    expect(screen.getByText('N5')).toBeInTheDocument();
    expect(screen.getByText('Expresses liking something')).toBeInTheDocument();
    const patternEl = screen.getByText('が好き');
    expect(patternEl.tagName.toLowerCase()).toBe('strong');
  });

  it('on error: shows "Grammar analysis unavailable"', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));
    render(<GrammarTooltip textId={1} sentenceIndex={0} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Grammar analysis unavailable')).toBeInTheDocument();
    });
  });

  it('empty result renders empty state message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [] }), { status: 200 }),
    );
    render(<GrammarTooltip textId={1} sentenceIndex={0} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No grammar patterns found')).toBeInTheDocument();
    });
  });

  it('initialPatterns skips fetch and renders patterns immediately', () => {
    vi.spyOn(global, 'fetch');
    render(
      <GrammarTooltip
        textId={1}
        sentenceIndex={0}
        initialPatterns={[mockPattern]}
        onClose={vi.fn()}
      />,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('が好き')).toBeInTheDocument();
  });

  it('calls onPatternsLoaded with fetched patterns', async () => {
    const onPatternsLoaded = vi.fn();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [mockPattern] }), { status: 200 }),
    );
    render(
      <GrammarTooltip
        textId={1}
        sentenceIndex={0}
        onPatternsLoaded={onPatternsLoaded}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onPatternsLoaded).toHaveBeenCalledWith([mockPattern]);
    });
  });

  it('Hide button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ patterns: [mockPattern] }), { status: 200 }),
    );
    render(<GrammarTooltip textId={1} sentenceIndex={0} onClose={onClose} />);

    await waitFor(() => expect(screen.getByText('が好き')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Hide grammar analysis' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
