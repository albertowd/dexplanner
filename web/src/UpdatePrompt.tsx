import { useRegisterSW } from 'virtual:pwa-register/react';

/** Lets the user pick up a new deploy (app shell + data) without losing their place. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <output className="toast">
      <span>{needRefresh ? 'A new version is available.' : 'Ready to work offline.'}</span>
      {needRefresh && <button onClick={() => updateServiceWorker(true)}>Reload</button>}
      <button
        className="ghost"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        Dismiss
      </button>
    </output>
  );
}
