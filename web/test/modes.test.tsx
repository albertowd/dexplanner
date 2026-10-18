import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { setDexMode } from '../src/dex.ts';
import { emptyState, getState, replaceState } from '../src/store.ts';
import { DexView } from '../src/views/DexView.tsx';
import { PokemonDetail } from '../src/views/PokemonDetail.tsx';
import { byName, data, gameMap } from './fixtures.ts';

beforeEach(() => {
  act(() => {
    replaceState(emptyState, 'tab');
    setDexMode({ shiny: false, living: false });
  });
});
afterEach(() => vi.unstubAllGlobals());

const card = (name: RegExp) => screen.getAllByRole('listitem').find((li) => name.test(li.textContent ?? ''))!;

describe('list modes', () => {
  it('switches to shiny mode: shiny sprites, shiny tags and separate progress', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    const toggle = screen.getByRole('button', { name: /Shiny/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    expect(card(/Pikachu/).querySelector('img')).toHaveAttribute('src', expect.stringMatching(/shiny\/25\.png$/));
    expect(within(card(/Koraidon/)).getByText('Shiny-locked')).toHaveAttribute('title', 'Shiny-locked in SV');
    expect(within(card(/Magearna/)).getByText('Past events')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark Pikachu as registered' }));
    expect(getState()).toMatchObject({ shiny: [25], registered: [] });
  });

  it('lists every form in living dex mode and marks forms separately', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    await user.click(screen.getByRole('button', { name: /Living dex/ }));
    expect(screen.getByText(`${data.pokemon.length + 3} entries`)).toBeInTheDocument();
    expect(screen.getByText('Alola Cap')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark Pikachu · Alola Cap as registered' }));
    expect(getState()).toMatchObject({ forms: ['pikachu-alola-cap'], registered: [] });

    await user.type(screen.getByRole('searchbox'), 'cap');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the progress of the current mode in the header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data))));
    act(() => replaceState({ ...emptyState, registered: [25], forms: ['pikachu-female'] }, 'tab'));
    render(<App />);
    expect(await screen.findByText(`1/${data.pokemon.length}`)).toBeInTheDocument();
    act(() => setDexMode({ living: true }));
    expect(screen.getByText(`2/${data.pokemon.length + 3}`)).toBeInTheDocument();
    act(() => setDexMode({ shiny: true }));
    expect(screen.getByText(`✨ 0/${data.pokemon.length + 3}`)).toBeInTheDocument();
  });
});

describe('details', () => {
  it('shows the shiny status and lets each form be marked', async () => {
    const user = userEvent.setup();
    render(<PokemonDetail pokemon={byName('pikachu')} games={gameMap} onClose={() => {}} />);
    expect(screen.getByText(/Shiny available/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Forms (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark Pikachu · Female as registered' }));
    expect(getState().forms).toEqual(['pikachu-female']);
  });

  it('explains a locked or event-only shiny and marks shinies in shiny mode', async () => {
    const user = userEvent.setup();
    act(() => setDexMode({ shiny: true }));
    const { unmount } = render(<PokemonDetail pokemon={byName('koraidon')} games={gameMap} onClose={() => {}} />);
    expect(screen.getByText(/Shiny-locked: no shiny has been obtainable/)).toBeInTheDocument();
    expect(screen.getByText(/Shiny-locked in SV/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mark as registered in HOME/ }));
    expect(getState().shiny).toEqual([1007]);
    unmount();

    render(<PokemonDetail pokemon={byName('pikachu')} games={gameMap} onClose={() => {}} />);
    // The Alola Cap form has its own (locked) shiny status; the female form inherits "available".
    expect(screen.getByText('Shiny-locked')).toHaveAttribute('title', 'Caps are never shiny');
    expect(document.querySelector('.detail-head img')).toHaveAttribute('src', expect.stringMatching(/home\/shiny\/25\.png$/));
  });
});
