import { useRef, useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { syncController, useSync, type SyncController } from '../sync/controller.ts';
import { closeDropdown, useDismissable } from '../useDismissable.ts';

/**
 * Red's FireRed/LeafGreen trainer sprite, loaded from Pokémon Showdown's sprite server at runtime.
 * It's Nintendo's artwork, so like the Pokémon sprites it isn't part of this repository.
 */
export const TRAINER_SPRITE = 'https://play.pokemonshowdown.com/sprites/trainers/red-gen3.png';

function Trainer() {
  const [failed, setFailed] = useState(false);
  // Offline or blocked: keep the space with a plain placeholder instead of a broken image.
  if (failed) return <span className="trainer trainer-fallback" aria-hidden="true" />;
  return <img className="trainer" src={TRAINER_SPRITE} alt="" width={40} height={40} onError={() => setFailed(true)} />;
}

/** Header sign-in button, or the signed-in trainer's name with a menu. Hidden when sync isn't configured. */
export function AccountMenu({ controller = syncController }: Readonly<{ controller?: SyncController }>) {
  const { available, user, busy, message } = useSync(controller);
  const { t } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  useDismissable(details);
  if (!available) return null;

  // Sign-in problems are shown here; other outcomes are shown in Settings.
  const notice = message?.key === 'cancelled' || message?.key === 'blocked' ? t.sync.messages[message.key] : null;
  const name = user?.name?.split(' ')[0] || user?.email || '';

  return (
    <>
      {user ? (
        <details ref={details} className="menu account-menu">
          <summary aria-label={t.account.menu(name)}>
            <Trainer />
            <span className="account-name">{name}</span>
          </summary>
          <div className="menu-panel">
            {user.email && <p className="menu-note">{user.email}</p>}
            <a className="menu-item" href="#/settings" onClick={(e) => closeDropdown(e.currentTarget)}>
              {t.account.syncSettings}
            </a>
            <button
              type="button"
              className="menu-item"
              disabled={busy}
              onClick={(e) => {
                closeDropdown(e.currentTarget);
                void controller.signOut();
              }}
            >
              {t.account.signOut}
            </button>
          </div>
        </details>
      ) : (
        <button
          type="button"
          className="account-signin"
          disabled={busy}
          title={t.account.signInHint}
          onClick={() => void controller.signIn()}
        >
          <Trainer />
          <span>{t.account.signIn}</span>
        </button>
      )}
      {notice && (
        <output className="toast">
          <span>{notice}</span>
          <button type="button" className="ghost" onClick={() => controller.clearMessage()}>
            {t.account.dismiss}
          </button>
        </output>
      )}
    </>
  );
}
