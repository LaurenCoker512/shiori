import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComprehensionList } from '@/components/dashboard/ComprehensionList';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleEntry = {
  text_id: 1,
  title: '吾輩は猫である',
  last_read_at: '2026-03-15T10:00:00Z',
  pct_known: 72,
};

describe('ComprehensionList — empty state', () => {
  it('shows empty message when both lists are empty', () => {
    render(<ComprehensionList comprehension={[]} />);
    expect(screen.getByText('No texts imported yet.')).toBeInTheDocument();
  });

  it('does not show empty message when processingTexts is present', () => {
    render(
      <ComprehensionList
        comprehension={[]}
        processingTexts={[{ id: 10, title: 'New Text' }]}
      />,
    );
    expect(screen.queryByText('No texts imported yet.')).not.toBeInTheDocument();
  });
});

describe('ComprehensionList — processing cards', () => {
  it('renders processing card title', () => {
    render(
      <ComprehensionList
        comprehension={[]}
        processingTexts={[{ id: 10, title: 'My New Text' }]}
      />,
    );
    expect(screen.getByText('My New Text')).toBeInTheDocument();
  });

  it('renders "Processing…" indicator on processing card', () => {
    render(
      <ComprehensionList
        comprehension={[]}
        processingTexts={[{ id: 10, title: 'My New Text' }]}
      />,
    );
    expect(screen.getByText('Processing…')).toBeInTheDocument();
  });

  it('renders multiple processing cards', () => {
    render(
      <ComprehensionList
        comprehension={[]}
        processingTexts={[
          { id: 10, title: 'Text A' },
          { id: 11, title: 'Text B' },
        ]}
      />,
    );
    expect(screen.getByText('Text A')).toBeInTheDocument();
    expect(screen.getByText('Text B')).toBeInTheDocument();
  });
});

describe('ComprehensionList — comprehension cards', () => {
  it('renders the card title', () => {
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    expect(screen.getByText('吾輩は猫である')).toBeInTheDocument();
  });

  it('renders the known percentage', () => {
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('renders formatted last_read_at date', () => {
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    expect(screen.getByText('Mar 15')).toBeInTheDocument();
  });

  it('shows "Not started" when last_read_at is null', () => {
    render(
      <ComprehensionList
        comprehension={[{ ...sampleEntry, last_read_at: null }]}
      />,
    );
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('card links to the correct text URL', () => {
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/texts/1');
  });

  it('renders multiple comprehension cards', () => {
    render(
      <ComprehensionList
        comprehension={[
          sampleEntry,
          { text_id: 2, title: '坊っちゃん', last_read_at: null, pct_known: 45 },
        ]}
      />,
    );
    expect(screen.getByText('吾輩は猫である')).toBeInTheDocument();
    expect(screen.getByText('坊っちゃん')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
});

describe('ComprehensionList — delete flow', () => {
  it('clicking Delete in overflow menu opens ConfirmDialog', async () => {
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/吾輩は猫である/)).toBeInTheDocument();
  });

  it('clicking Cancel in ConfirmDialog closes it', async () => {
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirming delete calls DELETE API and refreshes', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/texts/1', { method: 'DELETE' });
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });
});

describe('ComprehensionList — rename flow', () => {
  it('clicking Rename in overflow menu shows rename form with current title', async () => {
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    expect(screen.getByRole('textbox', { name: /text title/i })).toHaveValue('吾輩は猫である');
  });

  it('clicking Cancel in rename form restores the card', async () => {
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('submitting rename calls PATCH API and refreshes', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /text title/i });
    await user.clear(input);
    await user.type(input, '新しいタイトル');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/texts/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しいタイトル' }),
      });
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  it('submitting rename with empty title shows validation error', async () => {
    const user = userEvent.setup();
    render(<ComprehensionList comprehension={[sampleEntry]} />);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /text title/i });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Title cannot be empty');
  });
});
