import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { detectLocale, I18nProvider, localizeData, setLocalePreference, useI18n } from '../src/i18n/index.tsx';
import { en } from '../src/i18n/en.ts';
import { ptBR } from '../src/i18n/pt-BR.ts';
import { replaceState } from '../src/store.ts';
import { SettingsView } from '../src/views/SettingsView.tsx';
import { LanguageMenu } from '../src/header/LanguageMenu.tsx';
import type { DataTranslation, PokedexData } from '../src/types.ts';
import { data } from './fixtures.ts';

const translation: DataTranslation = {
  games: {
    'sv-id': { name: 'The Indigo Disk (DLC de SV, parte 2)', how: 'Como no SV.' },
    za: { how: 'Deposite no HOME.', note: 'Trava de Z-A' },
    home: { name: 'Recompensas do Pokémon HOME', short: 'Presente do HOME' },
  },
  notes: { Research: 'Pesquisa', 'National dex reward': 'Recompensa da Pokédex Nacional' },
};
const translated: PokedexData = { ...data, translations: { 'pt-BR': translation } };

function Probe() {
  const { locale, preference, t } = useI18n();
  return <span>{`${locale}|${preference}|${t.nav.settings}`}</span>;
}

beforeEach(() => {
  localStorage.clear();
  act(() => setLocalePreference('auto'));
  act(() => replaceState({ v: 1, registered: [], owned: [], showRetro: false }, 'tab'));
});
afterEach(() => vi.unstubAllGlobals());

describe('detectLocale', () => {
  it('uses Portuguese for any Portuguese browser language, English otherwise', () => {
    expect(detectLocale(['pt-BR'])).toBe('pt-BR');
    expect(detectLocale(['en-US', 'pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['es-ES', 'fr'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('dictionaries', () => {
  it('give Portuguese plurals and fall back sensibly', () => {
    expect(ptBR.dex.sources(0)).toBe('Nenhuma fonte atual');
    expect(ptBR.dex.sources(1)).toBe('1 fonte atual');
    expect(ptBR.dex.sources(3)).toBe('3 fontes atuais');
    expect(ptBR.filters.games(1)).toBe('1 jogo');
    expect(ptBR.filters.generations(2)).toBe('2 gerações');
    expect(ptBR.settings.markedPasted(2, [])).toBe('2 Pokémon marcados como registrados.');
    expect(ptBR.settings.markedPasted(1, ['x'])).toContain('Não reconhecidos: x');
    expect(en.dex.sources(1)).toBe('1 current source');
    expect(en.settings.markedPasted(1, [])).toBe('Marked 1 Pokémon as registered.');
  });
});

describe('localizeData', () => {
  it('translates game names, HOME text and notes, keeping English where missing', () => {
    const out = localizeData(data, translation);
    const game = (id: string) => out.games.find((g) => g.id === id)!;
    expect(game('sv-id')).toMatchObject({ name: 'The Indigo Disk (DLC de SV, parte 2)', short: 'SV: ID', home: { how: 'Como no SV.' } });
    expect(game('za').home).toMatchObject({ how: 'Deposite no HOME.', note: 'Trava de Z-A' });
    expect(game('home')).toMatchObject({ name: 'Recompensas do Pokémon HOME', short: 'Presente do HOME' });
    expect(game('sv')).toEqual(data.games.find((g) => g.id === 'sv'));
    const mew = out.pokemon.find((p) => p.slug === 'mew')!;
    expect(mew.avail.find((a) => a.game === 'go')?.note).toBe('Pesquisa');
  });

  it('translates each part of a combined note', () => {
    const combined = { ...data, pokemon: [{ ...data.pokemon[0], avail: [{ game: 'go', note: 'Research · Unknown' }] }] };
    expect(localizeData(combined, translation).pokemon[0].avail[0].note).toBe('Pesquisa · Unknown');
  });

  it('returns the data unchanged without a translation', () => {
    expect(localizeData(data, undefined)).toBe(data);
  });
});

describe('language preference', () => {
  it('follows the browser by default and can be changed per device', () => {
    vi.stubGlobal('navigator', { ...navigator, languages: ['pt-BR'], language: 'pt-BR' });
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByText('pt-BR|auto|Configurações')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');

    act(() => setLocalePreference('en'));
    expect(screen.getByText('en|en|Settings')).toBeInTheDocument();
    expect(localStorage.getItem('pokeplan:locale')).toBe('en');

    act(() => setLocalePreference('auto'));
    expect(localStorage.getItem('pokeplan:locale')).toBeNull();
  });

  it('ignores an unknown stored value', async () => {
    localStorage.setItem('pokeplan:locale', 'xx');
    vi.resetModules();
    const fresh = await import('../src/i18n/index.tsx');
    function FreshProbe() {
      return <span>{fresh.useI18n().preference}</span>;
    }
    render(<fresh.I18nProvider><FreshProbe /></fresh.I18nProvider>);
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('switches language from the header menu', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><LanguageMenu /><SettingsView data={translated} /></I18nProvider>);
    const summary = screen.getByLabelText('Language: English');
    await user.click(summary);
    await user.click(screen.getByRole('button', { name: 'Português (Brasil)' }));
    expect(screen.getByRole('heading', { name: 'Jogos que você tem' })).toBeInTheDocument();
    expect(screen.getByLabelText('Idioma: Português (Brasil)').closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByLabelText('Idioma: Português (Brasil)'));
    expect(screen.getByRole('button', { name: 'Português (Brasil)' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Automático (idioma do navegador)' }));
    expect(localStorage.getItem('pokeplan:locale')).toBeNull();
  });
});

describe('App in Portuguese', () => {
  it('shows the interface and the data translated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(translated))));
    act(() => setLocalePreference('pt-BR'));
    location.hash = '#/p/801';
    render(<I18nProvider><App /></I18nProvider>);
    expect(await screen.findByRole('link', { name: 'Plano' })).toBeInTheDocument();
    expect(await screen.findAllByText('Recompensas do Pokémon HOME')).not.toHaveLength(0);
    expect(screen.getAllByText('Recompensa da Pokédex Nacional')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Melhor forma de levar para o HOME' })).toBeInTheDocument();
  });
});
