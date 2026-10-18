import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from './i18n/index.tsx';

/** Lets the user pick up a new deploy (app shell + data) without losing their place. */
export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <output className="toast">
      <span>{needRefresh ? t.update.available : t.update.offlineReady}</span>
      {needRefresh && <button onClick={() => updateServiceWorker(true)}>{t.update.reload}</button>}
      <button
        className="ghost"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {t.update.dismiss}
      </button>
    </output>
  );
}
