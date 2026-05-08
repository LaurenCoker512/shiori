import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportForm } from '@/components/import/ImportForm';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeFile(content: string, name = 'test.txt'): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('ImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('submit button disabled when title is empty', () => {
    render(<ImportForm />);
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
  });

  it('submit button enabled when title and file are provided', async () => {
    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');
    await user.upload(screen.getByLabelText(/file/i), makeFile('Some content'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
    });
  });

  it('auto-fills title from filename when title field is empty', async () => {
    const user = userEvent.setup();
    render(<ImportForm />);
    await user.upload(screen.getByLabelText(/file/i), makeFile('content', 'my-story.txt'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('my-story')).toBeInTheDocument();
    });
  });

  it('long text warning appears when file content exceeds 30,000 characters', async () => {
    const user = userEvent.setup();
    render(<ImportForm />);
    await user.upload(screen.getByLabelText(/file/i), makeFile('a'.repeat(30001)));
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
    await user.upload(screen.getByLabelText(/file/i), makeFile('a'.repeat(30001)));
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
    const pendingRequest = new Promise<Response>(resolve => { resolveRequest = resolve; });
    vi.spyOn(global, 'fetch').mockReturnValue(pendingRequest);

    const user = userEvent.setup();
    render(<ImportForm />);
    await user.type(screen.getByLabelText(/title/i), 'My Title');
    await user.upload(screen.getByLabelText(/file/i), makeFile('content'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
    });

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
    await user.upload(screen.getByLabelText(/file/i), makeFile('content'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
    });
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
    await user.upload(screen.getByLabelText(/file/i), makeFile('content'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByText('Tokenization failed')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/title/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
  });
});
