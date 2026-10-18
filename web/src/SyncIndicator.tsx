import { useEffect, useState } from 'react';
import { useSync, syncController, type SyncController } from './sync/controller.ts';
import { useI18n } from './i18n/index.tsx';

/** Header pill showing whether progress is saved to the cloud; only shown while signed in. */
export function SyncIndicator({ controller = syncController }: Readonly<{ controller?: SyncController }>) {
  const { user, sync } = useSync(controller);
  const { t } = useI18n();
  const now = useNow(sync.status === 'pending');
  if (!user) return null;

  const seconds = sync.saveAt ? Math.max(0, Math.ceil((sync.saveAt - now) / 1000)) : 0;
  const pill = t.sync.pill;
  const label = {
    idle: pill.idle,
    pending: pill.pending(seconds),
    saving: pill.saving,
    saved: pill.saved,
    error: pill.error,
  }[sync.status];

  return (
    <output className={`sync-pill sync-${sync.status}`} title={sync.error ?? pill.title}>
      <span aria-hidden="true">☁</span>
      <span>{label}</span>
      {(sync.status === 'pending' || sync.status === 'error') && (
        <button type="button" className="ghost small" onClick={() => void controller.saveNow()}>
          {sync.status === 'error' ? pill.retry : pill.saveNow}
        </button>
      )}
    </output>
  );
}

/** Current time, refreshed every second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
