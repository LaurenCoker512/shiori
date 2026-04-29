import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrammarPatternLog } from '@/components/dashboard/GrammarPatternLog';
import type { GrammarPattern } from '@/lib/types';

const mockPatterns: (GrammarPattern & { sentence_count: number })[] = [
  {
    id: 1,
    pattern: 'が好き',
    description_en: 'Expresses liking something',
    jlpt_level: 'N5',
    first_encountered_at: '2024-01-01',
    sentence_count: 2,
  },
];

describe('GrammarPatternLog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking row expands and fetches GET /api/grammar-patterns/[id]/sentences', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ sentences: [{ text_id: 1, title: 'Test Text', sentence_index: 0, sentence_raw: '猫が好きです。' }] }),
        { status: 200 },
      ),
    );

    render(<GrammarPatternLog patterns={mockPatterns} />);
    await user.click(screen.getByRole('button', { name: /が好き/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/grammar-patterns/1/sentences');
    });
  });

  it('expanded content renders sentences grouped by title', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sentences: [
            { text_id: 1, title: 'Test Text', sentence_index: 0, sentence_raw: '猫が好きです。' },
            { text_id: 1, title: 'Test Text', sentence_index: 1, sentence_raw: '犬も好きです。' },
          ],
        }),
        { status: 200 },
      ),
    );

    render(<GrammarPatternLog patterns={mockPatterns} />);
    await user.click(screen.getByRole('button', { name: /が好き/i }));

    await waitFor(() => {
      expect(screen.getByText('Test Text')).toBeInTheDocument();
      expect(screen.getByText('猫が好きです。')).toBeInTheDocument();
      expect(screen.getByText('犬も好きです。')).toBeInTheDocument();
    });
  });

  it('second click collapses row', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sentences: [] }), { status: 200 }),
    );

    render(<GrammarPatternLog patterns={mockPatterns} />);
    const button = screen.getByRole('button', { name: /が好き/i });

    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
