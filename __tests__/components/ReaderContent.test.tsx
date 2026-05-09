import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReaderContent } from '@/components/reader/ReaderContent';

describe('ReaderContent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to showFurigana true when no localStorage key set', () => {
    render(<ReaderContent content={[]} wordStatusMap={{}} furiganaOverrides={[]} textId={1} />);
    expect(screen.getByRole('button', { name: /hide furigana/i })).toBeInTheDocument();
  });

  it('reads shiori-furigana from localStorage on mount', () => {
    localStorage.setItem('shiori-furigana', 'false');
    render(<ReaderContent content={[]} wordStatusMap={{}} furiganaOverrides={[]} textId={1} />);
    expect(screen.getByRole('button', { name: /show furigana/i })).toBeInTheDocument();
  });

  it('toggle button writes to localStorage on click', async () => {
    const user = userEvent.setup();
    render(<ReaderContent content={[]} wordStatusMap={{}} furiganaOverrides={[]} textId={1} />);
    await user.click(screen.getByRole('button', { name: /hide furigana/i }));
    expect(localStorage.getItem('shiori-furigana')).toBe('false');
  });
});
