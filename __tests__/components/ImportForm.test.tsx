import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportForm } from '@/components/import/ImportForm';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('ImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('submit button disabled when title is empty', () => {
    render(<ImportForm />);
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
  });

  it('submit button enabled when title and content are filled', async () => {
    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');
    await user.type(screen.getByLabelText(/content/i), 'Some content');
    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
  });

  it('format label updates as user types (auto-detect reflects input)', async () => {
    render(<ImportForm />);
    expect(screen.getByTestId('format-label')).toHaveTextContent('markdown');

    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: '<p>Hello</p>' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('format-label')).toHaveTextContent('html');
    });
  });

  it('long text warning appears when cleaned text > 30,000 characters', async () => {
    render(<ImportForm />);
    const longContent = '<p>' + 'a'.repeat(30001) + '</p>';
    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: longContent },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/This text is long and may take a moment to process/i),
      ).toBeInTheDocument();
    });
  });

  it('long text warning does not block submission', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), { status: 200 }),
    );

    const user = userEvent.setup();
    render(<ImportForm />);

    await user.type(screen.getByLabelText(/title/i), 'My Title');
    const longContent = '<p>' + 'a'.repeat(30001) + '</p>';
    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: longContent },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/This text is long and may take a moment to process/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/texts/42');
    });
  });

  it('shows Spinner while request is in flight', async () => {
    let resolveRequest!: (value: Response) => void;
    const pendingRequest = new Promise<Response>(resolve => {
      resolveRequest = resolve;
    });
    vi.spyOn(global, 'fetch').mockReturnValue(pendingRequest);

    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');

    await user.click(screen.getByRole('button', { name: /^import$/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();

    resolveRequest(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('on success: calls router.push with the correct text id', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 99 }), { status: 200 }),
    );

    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/texts/99');
    });
  });

  it('on error: shows inline error message, form remains editable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Tokenization failed' }), { status: 500 }),
    );

    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText('Tokenization failed')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/title/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
  });
});
