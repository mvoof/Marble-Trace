import React from 'react';
import ReactDOM from 'react-dom/client';

import { initRemoteSync } from '@platform/sync/remote-sync';
import { RemoteScreenStore } from '@store/remote/remote-screen.store';
import { RemoteScreenContext } from '@store/remote/remote-screen-context';
import { RemoteRoot } from '@store/roots/remote-root';
import { CoreProvider } from '@ui/app/store-providers';
import { RemoteWindow } from '@ui/app/remote/RemoteWindow';
import './i18n';
import './styles/index.scss';

/**
 * Entry point of a remote screen — a layout rendered in a browser on another
 * device.
 *
 * Deliberately not a route of `main.tsx`: that entry pulls in the Tauri API and
 * the whole main-window UI, neither of which exists here. This file loads the
 * widgets and nothing else, which is also why the page works in a plain
 * browser at all.
 */

/** `/r/<slug>` — the screen this device was opened for. */
const slugFromLocation = (): string => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const index = segments.indexOf('r');

  return index >= 0 ? (segments[index + 1] ?? '') : (segments[0] ?? '');
};

const params = new URLSearchParams(window.location.search);
const token = params.get('t') ?? '';

const screenStore = new RemoteScreenStore(slugFromLocation());

const rootStore = new RemoteRoot();

initRemoteSync(rootStore, screenStore, token);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CoreProvider core={rootStore}>
      <RemoteScreenContext.Provider value={screenStore}>
        <RemoteWindow />
      </RemoteScreenContext.Provider>
    </CoreProvider>
  </React.StrictMode>
);
