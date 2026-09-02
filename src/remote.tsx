import React from 'react';
import ReactDOM from 'react-dom/client';

import { initRemoteSync } from '@platform/sync/remote-sync';
import { RemoteScreenStore } from '@store/remote/remote-screen.store';
import { RemoteScreenContext } from '@store/remote/remote-screen-context';
import { RootStore } from '@store/root-store';
import { RootStoreContext } from '@store/root-store-context';
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

// `?widget=<instance id>` turns the page into that one widget's own rectangle,
// which is how a widget becomes a single OBS browser source.
const screenStore = new RemoteScreenStore(
  slugFromLocation(),
  params.get('widget') ?? ''
);

// `skipInit` matters: the init path opens Tauri channels — the telemetry
// stream, the settings file, the chat connectors — none of which a browser
// has. Everything a remote screen shows arrives over the socket instead.
const rootStore = new RootStore({ skipInit: true });

rootStore.flags.init();
rootStore.paceCar.init();
rootStore.radar.init();
rootStore.drivingCoachWidget.init();
rootStore.coachWidget.init();
rootStore.pitServiceWidget.init();

initRemoteSync(rootStore, screenStore, token);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootStoreContext.Provider value={rootStore}>
      <RemoteScreenContext.Provider value={screenStore}>
        <RemoteWindow />
      </RemoteScreenContext.Provider>
    </RootStoreContext.Provider>
  </React.StrictMode>
);
