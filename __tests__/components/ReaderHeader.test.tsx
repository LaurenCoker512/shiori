import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReaderHeader } from '@/components/reader/ReaderHeader';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /more options/i }));
}

describe('ReaderHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('clicking rename opens inline input pre-filled with current title', async () => {
    const user = userEvent.setup();
    render(<ReaderHeader title="My Text" textId={1} />);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));

    const input = screen.getByRole('textbox', { name: /text title/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('My Text');
  });

  it('submit with new title calls PATCH /api/texts/[id]', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1, title: 'New Title' }), { status: 200 }),
    );

    render(<ReaderHeader title="Old Title" textId={5} />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));

    const input = screen.getByRole('textbox', { name: /text title/i });
    await user.clear(input);
    await user.type(input, 'New Title');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/texts/5',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'New Title' }),
        }),
      );
    });
  });

  it('submit with empty title shows validation error, no API call', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch');

    render(<ReaderHeader title="My Text" textId={1} />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));

    const input = screen.getByRole('textbox', { name: /text title/i });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Title cannot be empty');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('clicking delete opens ConfirmDialog', async () => {
    const user = userEvent.setup();
    render(<ReaderHeader title="My Text" textId={1} />);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('confirming delete calls DELETE /api/texts/[id] and redirects to /', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    render(<ReaderHeader title="My Text" textId={3} />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/texts/3', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('cancelling delete makes no API call', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch');

    render(<ReaderHeader title="My Text" textId={1} />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
