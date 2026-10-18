// Test double for `virtual:pwa-register/react`, which only exists in a Vite build with vite-plugin-pwa.
import { useState } from 'react';

export const pwaState = { needRefresh: false, offlineReady: false, updateServiceWorker: (_reload?: boolean) => {} };

export function useRegisterSW() {
  const needRefresh = useState(pwaState.needRefresh);
  const offlineReady = useState(pwaState.offlineReady);
  return { needRefresh, offlineReady, updateServiceWorker: pwaState.updateServiceWorker };
}
