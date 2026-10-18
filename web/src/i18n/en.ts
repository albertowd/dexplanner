// English interface text. Other languages must provide the same keys (checked by TypeScript).
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const en = {
  nav: { dex: 'Pokédex', plan: 'Plan', settings: 'Settings' },
  app: {
    progress: 'Registered in your HOME Pokédex',
    loading: 'Loading Pokédex…',
    loadError: (detail: string) => `Could not load Pokédex data (${detail}).`,
  },
  update: {
    available: 'A new version is available.',
    offlineReady: 'Ready to work offline.',
    reload: 'Reload',
    dismiss: 'Dismiss',
  },
  filters: {
    search: 'Search',
    searchPlaceholder: 'Search by name or number',
    status: 'Status',
    all: 'All',
    missing: 'Missing in HOME',
    registered: 'Registered',
    generation: 'Generation',
    allGenerations: 'All generations',
    generations: (n: number) => `${n} ${plural(n, 'generation', 'generations')}`,
    gen: (n: number | string) => `Gen ${n}`,
    obtainableIn: 'Obtainable in',
    anyGame: 'Any game or DLC',
    games: (n: number) => `${n} ${plural(n, 'game', 'games')}`,
    clear: 'Clear',
    clearFilter: (label: string) => `Clear ${label}`,
  },
  dex: {
    count: (n: number) => `${n} Pokémon`,
    markShown: 'Mark shown as registered',
    unmarkShown: 'Unmark shown',
    mark: (name: string) => `Mark ${name} as registered`,
    unmark: (name: string) => `Unmark ${name}`,
    sources: (n: number) => (n === 0 ? 'No current source' : `${n} current ${plural(n, 'source', 'sources')}`),
  },
  detail: {
    close: 'Close',
    legendary: 'Legendary',
    mythical: 'Mythical',
    isRegistered: '✓ Registered in HOME',
    markRegistered: 'Mark as registered in HOME',
    best: 'Best way to get it into HOME',
    noCurrent: 'No current way to obtain it',
    noCurrentText:
      'It was only available through past events or games that no longer connect easily. Trading with someone in HOME (GTS, Wonder Box or Room Trade) also registers it when it lands in your boxes.',
    current: 'Current games and apps',
    none: 'None.',
    retro: (n: number) => `Retro games (${n})`,
    footnote:
      'HOME registers a Pokémon in its National Pokédex when it is deposited in a HOME box. Trades received in HOME count too.',
    owned: 'Owned',
    only: (versions: string) => `${versions} only`,
  },
  method: {
    catch: 'Catch',
    evolve: 'Evolve',
    gift: 'Gift',
    raid: 'Raid',
    event: 'Past event only',
    trade: 'Trade',
    dex: 'In game (gift, trade or special)',
  },
  link: {
    'two-way': 'HOME two-way',
    'one-way': 'HOME one-way',
    bank: 'Via Pokémon Bank',
    transporter: 'Via Transporter + Bank',
    none: 'No HOME link',
  },
  plan: {
    complete: 'Your HOME Pokédex is complete. Congratulations!',
    lead: (n: number) =>
      `${n} Pokémon missing. Games you own come first, then the game or DLC that unlocks the most missing Pokémon at each step.`,
    includeRetro: 'Include retro games (via Pokémon Bank, which shuts down 25 Feb 2027)',
    goLeftOut: ['Pokémon GO is left out of the plan. Tick it in ', 'Settings', ' if you play it.'] as const,
    owned: 'Owned',
    toGet: 'To get',
    needs: (game: string) => `Needs ${game}`,
    unobtainable: (n: number) => `Not obtainable with this plan (${n})`,
    unobtainableText:
      'Past events, Pokémon GO-only species (if GO is off), or retro-only species. Trading in HOME is the fallback.',
  },
  language: {
    label: 'Language',
    current: (name: string) => `Language: ${name}`,
    auto: 'Automatic (browser language)',
  },
  account: {
    signIn: 'Sign in',
    signInHint: 'Sign in with Google to sync your progress across devices',
    menu: (name: string) => `Account: ${name}`,
    syncSettings: 'Sync settings',
    signOut: 'Sign out',
    dismiss: 'Dismiss',
  },
  settings: {
    owned: 'Games you own',
    ownedHint: "The plan uses these first, and each Pokémon's best route prefers them.",
    showRetro: 'Show retro games (3DS, DS, GBA)',
    homeSync: 'Pokémon HOME sync',
    homeSyncText:
      "Pokémon HOME has no public API, export or share feature, so this app can't read your HOME Pokédex automatically. Mark Pokémon as you register them, or paste a list below. Your progress is stored in this browser; sign in or use a backup to move it to another device.",
    markEverything: 'Mark everything',
    markEverythingHint: "Only a few Pokémon left to catch? Mark everything as registered, then untick the ones you're missing.",
    markAll: 'Mark all as registered',
    markAllConfirm: (n: number) => `Mark all ${n} Pokémon as registered?`,
    markedAll: (n: number) => `Marked all ${n} Pokémon as registered.`,
    unmarkAll: 'Unmark all',
    unmarkAllConfirm: 'Unmark every registered Pokémon?',
    unmarkedAll: 'All Pokémon unmarked.',
    pasteList: 'Paste a list',
    pastePlaceholder: 'e.g. 1, 4, 7, pikachu, Mewtwo',
    markPasted: 'Mark as registered',
    markedPasted: (n: number, unknown: string[]) => {
      const notRecognised = unknown.length ? ' Not recognised: ' + unknown.join(', ') : '';
      return `Marked ${n} Pokémon as registered.${notRecognised}`;
    },
    backup: 'Backup',
    exportBackup: 'Export backup',
    importBackup: 'Import backup',
    imported: (n: number) => `Imported ${n} registered Pokémon.`,
    notBackup: 'This file is not a PokePlan backup.',
    reset: 'Reset',
    resetConfirm: 'Clear all registered Pokémon and owned games?',
    resetDone: 'Progress cleared.',
    about: 'About the data',
    builtFrom: (date: string) => `Data built ${date} from:`,
    license: ['PokePlan is free software under the ', 'GNU AGPL v3.0', '. ', 'Source code and contributions', '.'] as const,
    disclaimer:
      'Unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and Pokémon character names are trademarks of Nintendo; Pokémon images are © Nintendo, Creatures and GAME FREAK.',
  },
  sync: {
    title: 'Sync across devices',
    signedInAs: (name: string) => `Signed in as ${name}.`,
    status: {
      idle: 'Connecting…',
      pending: 'Changes waiting to be saved.',
      saving: 'Saving…',
      saved: 'All changes saved.',
      error: 'Last save failed; it will retry.',
    },
    hint: 'Changes are saved about 30 seconds after your last edit, or right away with “Save now” in the header.',
    signOut: 'Sign out',
    deleteAccount: 'Delete cloud data and account',
    deleteConfirm: 'Delete your cloud data and PokePlan account? Progress on this device is kept.',
    pitch:
      'Sign in to keep your progress and owned games in sync on all your devices. Your progress on this device is merged with your account the first time; nothing is lost.',
    privacy: 'PokePlan stores only your Google account id, name and email (for sign-in) and your progress.',
    signIn: 'Sign in with Google',
    messages: {
      cancelled: 'Sign-in was cancelled.',
      blocked: 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
      signedOut: 'Signed out. Your progress stays on this device.',
      deleted: 'Your cloud data and account were deleted. Your progress stays on this device.',
    },
    pill: {
      idle: 'Cloud sync',
      pending: (s: number) => `Saving in ${s}s`,
      saving: 'Saving…',
      saved: 'Saved',
      error: 'Not saved',
      title: 'Progress saved to your account',
      saveNow: 'Save now',
      retry: 'Retry',
    },
  },
};

/** Shape every language must provide: same keys, same function signatures, any text. */
type Widen<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends readonly string[]
    ? { readonly [K in keyof T]: string }
    : T extends string
      ? string
      : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;
