import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverflowMenu } from '@/components/ui/OverflowMenu';

function renderMenu(overrides: Partial<Parameters<typeof OverflowMenu>[0]> = {}) {
  const props = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<OverflowMenu {...props} />);
  return props;
}

describe('OverflowMenu', () => {
  it('menu is hidden by default', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggle button has aria-expanded=false when closed', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /more options/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking the toggle opens the menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /more options/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more options/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking the toggle again closes the menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    const toggle = screen.getByRole('button', { name: /more options/i });
    await user.click(toggle);
    await user.click(toggle);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking Rename calls onRename and closes the menu', async () => {
    const user = userEvent.setup();
    const { onRename } = renderMenu();
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking Delete calls onDelete and closes the menu', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderMenu();
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Reparse item is absent when onReparse is not provided', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /more options/i }));
    expect(screen.queryByRole('menuitem', { name: /reparse/i })).not.toBeInTheDocument();
  });

  it('clicking Reparse calls onReparse and closes the menu', async () => {
    const user = userEvent.setup();
    const onReparse = vi.fn();
    renderMenu({ onReparse });
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('menuitem', { name: /reparse/i }));
    expect(onReparse).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
