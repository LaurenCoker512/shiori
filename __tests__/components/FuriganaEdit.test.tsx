import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuriganaEdit } from '@/components/reader/FuriganaEdit';

describe('FuriganaEdit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pre-fills input with current reading', () => {
    render(
      <FuriganaEdit
        wordId={1}
        surfaceForm="猫"
        currentReading="ねこ"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('ねこ');
  });

  it('input is accessible by aria-label', () => {
    render(
      <FuriganaEdit
        wordId={1}
        surfaceForm="猫"
        currentReading="ねこ"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /furigana reading for 猫/i })).toBeInTheDocument();
  });

  it('on save: calls POST /api/furigana-overrides with correct payload', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    render(
      <FuriganaEdit
        wordId={1}
        surfaceForm="猫"
        currentReading="ねこ"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'にゃん');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/furigana-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: 1, surface_form: '猫', corrected_reading: 'にゃん' }),
      });
    });
  });

  it('on save: calls onSave callback with new reading', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    render(
      <FuriganaEdit
        wordId={1}
        surfaceForm="猫"
        currentReading="ねこ"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('ねこ');
    });
  });

  it('on cancel: no API call made', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch');
    const onCancel = vi.fn();

    render(
      <FuriganaEdit
        wordId={1}
        surfaceForm="猫"
        currentReading="ねこ"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
