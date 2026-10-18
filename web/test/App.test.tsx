import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { UpdatePrompt } from '../src/UpdatePrompt.tsx';
import { replaceState, emptyState } from '../src/store.ts';
import { pwaState } from './stubs/pwa-register.ts';
import { data } from './fixtures.ts';

function navigate(hash: string) {
  act(() => {
    location.hash = hash;
    globalThis.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('App', () => {
  beforeEach(() => {
    act(() => replaceState({ ...emptyState, registered: [25], owned: [], showRetro: false }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the data and shows progress', async () => {
    render(<App />);
    expect(screen.getByText('Loading Pokédex…')).toBeInTheDocument();
    expect(await screen.findByText(`1/${data.pokemon.length}`)).toBeInTheDocument();
  });

  it('shows the app version', () => {
    render(<App />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('DexPlanner v0.0.0-test');
  });

  it('routes between views and opens a Pokémon from the URL', async () => {
    render(<App />);
    await screen.findByText(`${data.pokemon.length} Pokémon`);

    navigate('#/plan');
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    navigate('#/settings');
    expect(screen.getByRole('heading', { name: 'Games you own' })).toBeInTheDocument();
    navigate('#/p/248');
    expect(screen.getByRole('heading', { name: 'Tyranitar' })).toBeInTheDocument();
  });

  it('returns to the Pokédex when the detail closes', async () => {
    const user = userEvent.setup();
    location.hash = '#/p/25';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(location.hash).toBe('#/');
  });

  it('shows a load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    render(<App />);
    expect(await screen.findByText('Could not load Pokédex data (HTTP 500).')).toBeInTheDocument();
  });
});

describe('UpdatePrompt', () => {
  afterEach(() => Object.assign(pwaState, { needRefresh: false, offlineReady: false }));

  it('renders nothing by default', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a reload when a new version is waiting', async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    Object.assign(pwaState, { needRefresh: true, updateServiceWorker: update });
    render(<UpdatePrompt />);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(update).toHaveBeenCalledWith(true);
  });

  it('can be dismissed once offline-ready', async () => {
    const user = userEvent.setup();
    Object.assign(pwaState, { offlineReady: true });
    render(<UpdatePrompt />);
    expect(screen.getByText('Ready to work offline.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
