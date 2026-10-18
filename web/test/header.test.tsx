import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu, TRAINER_SPRITE } from '../src/header/AccountMenu.tsx';
import type { SyncController, SyncState } from '../src/sync/controller.ts';

/** Minimal controller double whose state the test can change. */
function fakeController(initial: Partial<SyncState>) {
  let state: SyncState = {
    available: true,
    user: null,
    busy: false,
    sync: { status: 'idle', saveAt: null, error: null },
    message: null,
    ...initial,
  };
  const listeners = new Set<() => void>();
  const controller = {
    getState: () => state,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    clearMessage: vi.fn(() => controller.set({ message: null })),
    set(next: Partial<SyncState>) {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
  };
  return controller;
}
const asController = (c: ReturnType<typeof fakeController>) => c as unknown as SyncController;

describe('AccountMenu', () => {
  it('is hidden when cloud sync is not configured', () => {
    const { container } = render(<AccountMenu controller={asController(fakeController({ available: false }))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers sign-in with the pixel trainer when signed out', async () => {
    const user = userEvent.setup();
    const c = fakeController({});
    const { container } = render(<AccountMenu controller={asController(c)} />);
    expect(container.querySelector('img.trainer')).toHaveAttribute('src', TRAINER_SPRITE);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(c.signIn).toHaveBeenCalled();
  });

  it('shows sign-in problems as a dismissible notice', async () => {
    const user = userEvent.setup();
    const c = fakeController({ message: { key: 'blocked' } });
    render(<AccountMenu controller={asController(c)} />);
    expect(screen.getByRole('status')).toHaveTextContent('The sign-in window was blocked.');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores outcomes that Settings shows', () => {
    render(<AccountMenu controller={asController(fakeController({ message: { key: 'signedOut' } }))} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the trainer name with a menu to sign out when signed in', async () => {
    const user = userEvent.setup();
    const c = fakeController({ user: { uid: 'ash', name: 'Ash Ketchum', email: 'ash@example.com', photoUrl: null } });
    render(<AccountMenu controller={asController(c)} />);
    const summary = screen.getByLabelText('Account: Ash');
    expect(summary).toHaveTextContent('Ash');
    await user.click(summary);
    expect(screen.getByText('ash@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sync settings' })).toHaveAttribute('href', '#/settings');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(c.signOut).toHaveBeenCalled();
    expect(summary.closest('details')).not.toHaveAttribute('open');
  });

  it('falls back to the email when there is no name', () => {
    render(<AccountMenu controller={asController(fakeController({ user: { uid: 'x', name: null, email: 'misty@example.com', photoUrl: null } }))} />);
    expect(screen.getByLabelText('Account: misty@example.com')).toBeInTheDocument();
  });

  it('keeps the space with a placeholder when the sprite cannot load', () => {
    const { container } = render(<AccountMenu controller={asController(fakeController({}))} />);
    fireEvent.error(container.querySelector('img.trainer')!);
    expect(container.querySelector('img.trainer')).toBeNull();
    expect(container.querySelector('.trainer-fallback')).not.toBeNull();
  });
});
