import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DexView } from '../src/views/DexView.tsx';
import { PlanView } from '../src/views/PlanView.tsx';
import { PokemonDetail } from '../src/views/PokemonDetail.tsx';
import { SettingsView } from '../src/views/SettingsView.tsx';
import { replaceState, emptyState } from '../src/store.ts';
import { byName, data, gameMap } from './fixtures.ts';

const reset = (partial: Partial<{ registered: number[]; owned: string[]; showRetro: boolean }> = {}) =>
  act(() => replaceState({ ...emptyState, registered: [], owned: [], showRetro: false, ...partial }));

beforeEach(() => reset());

/** Opens a filter dropdown (if closed) and toggles one checkbox. */
async function pick(user: ReturnType<typeof userEvent.setup>, filter: string, option: string) {
  const summary = screen.getByLabelText(new RegExp(`^${filter}:`));
  if (!summary.closest('details')!.open) await user.click(summary);
  await user.click(screen.getByRole('checkbox', { name: option }));
}

const cardNames = () => screen.queryAllByRole('listitem').map((li) => within(li).getByText(/^#\d{4}$/).nextSibling?.textContent);

describe('DexView', () => {
  it('lists every Pokémon with its number of current sources', () => {
    render(<DexView data={data} games={gameMap} />);
    expect(screen.getByText(`${data.pokemon.length} Pokémon`)).toBeInTheDocument();
    expect(screen.getByText('#0025')).toBeInTheDocument();
    expect(screen.getAllByText('No current source').length).toBeGreaterThan(0);
  });

  it('searches by name and by number', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    const search = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(search, 'pika');
    expect(cardNames()).toEqual(['Pikachu']);
    await user.clear(search);
    await user.type(search, '#248');
    expect(cardNames()).toEqual(['Tyranitar']);
  });

  it('filters by several generations and games at once', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    await pick(user, 'Generation', 'Gen 9');
    expect(cardNames()).toEqual(['Koraidon', 'Walking Wake', 'Iron Leaves']);
    expect(screen.getByLabelText('Generation: Gen 9')).toBeInTheDocument();
    await pick(user, 'Generation', 'Gen 2');
    expect(cardNames()).toEqual(['Tyranitar', 'Koraidon', 'Walking Wake', 'Iron Leaves']);
    expect(screen.getByLabelText('Generation: 2 generations')).toBeInTheDocument();

    await pick(user, 'Obtainable in', 'Pokémon Scarlet / Violet');
    expect(cardNames()).toEqual(['Tyranitar', 'Koraidon']);
    await user.click(screen.getByRole('button', { name: 'Clear Obtainable in' }));
    expect(screen.getByLabelText('Obtainable in: Any game or DLC')).toBeInTheDocument();
  });

  it('lists DLC under their game and combines several games', async () => {
    const user = userEvent.setup();
    const withDlc = {
      ...data,
      pokemon: data.pokemon.map((p) => (p.slug === 'walking-wake' ? { ...p, avail: [{ game: 'sv-id' }] } : p)),
    };
    render(<DexView data={withDlc} games={gameMap} />);
    await pick(user, 'Obtainable in', 'The Indigo Disk');
    expect(screen.getByRole('checkbox', { name: 'The Indigo Disk' }).closest('label')).toHaveClass('child');
    expect(cardNames()).toEqual(['Walking Wake']);
    await pick(user, 'Obtainable in', "Let's Go");
    expect(cardNames()).toEqual(['Bulbasaur', 'Walking Wake']);
  });

  it('closes the dropdown on Escape or a click outside', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    const summary = screen.getByLabelText(/^Generation:/);
    const details = summary.closest('details')!;
    await user.click(summary);
    expect(details).toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(details).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
    await user.click(summary);
    await user.click(screen.getByRole('searchbox', { name: 'Search' }));
    expect(details).not.toHaveAttribute('open');
  });

  it('only offers retro games in the game filter when enabled', () => {
    const { unmount } = render(<DexView data={data} games={gameMap} />);
    expect(screen.queryByRole('checkbox', { name: /Ultra Sun/ })).not.toBeInTheDocument();
    unmount();
    reset({ showRetro: true });
    render(<DexView data={data} games={gameMap} />);
    expect(screen.getByRole('checkbox', { name: /Ultra Sun/ })).toBeInTheDocument();
  });

  it('toggles registration and filters by status', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    await user.click(screen.getByRole('button', { name: 'Mark Pikachu as registered' }));
    expect(screen.getByRole('button', { name: 'Unmark Pikachu' })).toHaveAttribute('aria-pressed', 'true');

    const status = screen.getByRole('combobox', { name: 'Status' });
    await user.selectOptions(status, 'registered');
    expect(cardNames()).toEqual(['Pikachu']);
    await user.selectOptions(status, 'missing');
    expect(cardNames()).not.toContain('Pikachu');
  });

  it('marks and unmarks every shown Pokémon at once', async () => {
    const user = userEvent.setup();
    render(<DexView data={data} games={gameMap} />);
    await pick(user, 'Generation', 'Gen 1');
    await user.click(screen.getByRole('button', { name: 'Mark shown as registered' }));
    expect(screen.getAllByRole('button', { name: /^Unmark (?!shown)/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Unmark shown' }));
    expect(screen.queryAllByRole('button', { name: /^Unmark (?!shown)/ })).toHaveLength(0);
  });
});

describe('PokemonDetail', () => {
  it('shows the best route, all current sources and retro games', () => {
    render(<PokemonDetail pokemon={byName('tyranitar')} games={gameMap} onClose={() => {}} />);
    const best = screen.getByRole('heading', { name: 'Best way to get it into HOME' }).parentElement!;
    expect(within(best).getByText('Pokémon Scarlet / Violet')).toBeInTheDocument();
    expect(within(best).getByText('Scarlet only')).toBeInTheDocument();
    expect(screen.getByText('Retro games (1)')).toBeInTheDocument();
  });

  it('warns when there is no current way to obtain it', () => {
    render(<PokemonDetail pokemon={byName('walking-wake')} games={gameMap} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No current way to obtain it' })).toBeInTheDocument();
    expect(screen.getByText('Past event only')).toBeInTheDocument();
  });

  it('shows notes, caveats and owned games', () => {
    reset({ owned: ['za'] });
    render(<PokemonDetail pokemon={byName('pikachu')} games={gameMap} onClose={() => {}} />);
    expect(screen.getAllByText('Owned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Z-A lock').length).toBeGreaterThan(0);
  });

  it('says so when no current game has it', () => {
    render(<PokemonDetail pokemon={byName('iron-leaves')} games={gameMap} onClose={() => {}} />);
    expect(screen.getByText('None.')).toBeInTheDocument();
  });

  it('toggles registration and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PokemonDetail pokemon={byName('pikachu')} games={gameMap} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Mark as registered in HOME' }));
    expect(screen.getByRole('button', { name: '✓ Registered in HOME' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the browser close it on a backdrop click or Esc', () => {
    render(<PokemonDetail pokemon={byName('pikachu')} games={gameMap} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('closedby', 'any');
  });
});

describe('PlanView', () => {
  it('lists steps with what each one unlocks', () => {
    render(<PlanView data={data} />);
    expect(screen.getByText(`${data.pokemon.length} Pokémon missing.`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Pokémon HOME rewards')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/Not obtainable with this plan/)).toBeInTheDocument();
    expect(screen.getByText(/Pokémon GO is left out/)).toBeInTheDocument();
  });

  it('shows which base game a DLC needs', () => {
    const dlcData = { ...data, pokemon: [{ ...byName('walking-wake'), avail: [{ game: 'sv-id' }] }] };
    reset({ owned: ['sv'] });
    render(<PlanView data={dlcData} />);
    expect(screen.getByText('Needs SV')).toBeInTheDocument();
  });

  it('toggles retro games', async () => {
    const user = userEvent.setup();
    const retroOnly = { ...data, pokemon: [{ ...byName('tyranitar'), avail: [{ game: 'usum' }] }] };
    render(<PlanView data={retroOnly} />);
    expect(screen.queryByText('Ultra Sun / Ultra Moon')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Include retro games/ }));
    expect(screen.getByText('Ultra Sun / Ultra Moon')).toBeInTheDocument();
  });

  it('congratulates a complete Pokédex', () => {
    reset({ registered: data.pokemon.map((p) => p.id) });
    render(<PlanView data={data} />);
    expect(screen.getByText(/Pokédex is complete/)).toBeInTheDocument();
  });
});

describe('SettingsView', () => {
  it('toggles owned games and retro games', async () => {
    const user = userEvent.setup();
    render(<SettingsView data={data} />);
    const sv = screen.getByRole('checkbox', { name: /Scarlet \/ Violet/ });
    await user.click(sv);
    expect(sv).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /Pokémon HOME rewards/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Show retro games/ }));
    expect(screen.getByRole('checkbox', { name: /Ultra Sun/ })).toBeInTheDocument();
  });

  it('marks everything, then unmarks everything, after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    render(<SettingsView data={data} />);
    await user.click(screen.getByRole('button', { name: 'Mark all as registered' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all as registered' }));
    expect(screen.getByRole('status')).toHaveTextContent(`Marked all ${data.pokemon.length} Pokémon as registered.`);
    expect(JSON.parse(localStorage.getItem('dexplanner:v1')!).registered).toHaveLength(data.pokemon.length);
    await user.click(screen.getByRole('button', { name: 'Unmark all' }));
    expect(screen.getByRole('status')).toHaveTextContent('All Pokémon unmarked.');
    expect(JSON.parse(localStorage.getItem('dexplanner:v1')!).registered).toEqual([]);
    confirm.mockRestore();
  });

  it('marks a pasted list and reports unknown entries', async () => {
    const user = userEvent.setup();
    render(<SettingsView data={data} />);
    await user.type(screen.getByRole('textbox'), '#1, pikachu, Koraidon, 9999, missingno');
    await user.click(screen.getByRole('button', { name: 'Mark as registered' }));
    expect(screen.getByRole('status')).toHaveTextContent('Marked 3 Pokémon as registered. Not recognised: 9999, missingno');
  });

  it('exports a backup file', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:backup');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<SettingsView data={data} />);
    await user.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('imports a backup and rejects invalid files', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsView data={data} />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    await user.upload(input, new File(['{"registered":[1,25]}'], 'backup.json', { type: 'application/json' }));
    expect(await screen.findByText('Imported 2 registered Pokémon.')).toBeInTheDocument();
    await user.upload(input, new File(['{"x":1}'], 'other.json', { type: 'application/json' }));
    expect(await screen.findByText('This file is not a DexPlanner backup.')).toBeInTheDocument();
  });

  it('resets progress after confirmation', async () => {
    const user = userEvent.setup();
    reset({ registered: [1] });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SettingsView data={data} />);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('status')).toHaveTextContent('Progress cleared.');
  });
});
