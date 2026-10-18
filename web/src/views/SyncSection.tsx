import { useI18n } from '../i18n/index.tsx';
import { syncController, useSync, type SyncController } from '../sync/controller.ts';

/** Settings section to sign in and keep progress in sync across devices. Hidden when not configured. */
export function SyncSection({ controller = syncController }: Readonly<{ controller?: SyncController }>) {
  const { available, user, busy, sync, message } = useSync(controller);
  const { t } = useI18n();
  if (!available) return null;

  const messageText = message && (message.key === 'error' ? message.detail : t.sync.messages[message.key]);

  return (
    <>
      <h2>{t.sync.title}</h2>
      {user ? (
        <div className="callout">
          <p>
            {t.sync.signedInAs(user.name && user.email ? `${user.name} (${user.email})` : (user.name ?? user.email ?? ''))}{' '}
            {t.sync.status[sync.status]}
          </p>
          <p className="muted small">{t.sync.hint}</p>
          <div className="row">
            <button type="button" className="secondary" disabled={busy} onClick={() => void controller.signOut()}>
              {t.sync.signOut}
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                if (confirm(t.sync.deleteConfirm)) void controller.deleteAccount();
              }}
            >
              {t.sync.deleteAccount}
            </button>
          </div>
        </div>
      ) : (
        <div className="callout">
          <p>{t.sync.pitch}</p>
          <p className="muted small">{t.sync.privacy}</p>
          <button type="button" disabled={busy} onClick={() => void controller.signIn()}>
            {t.sync.signIn}
          </button>
        </div>
      )}
      {messageText && <output className="message">{messageText}</output>}
    </>
  );
}
