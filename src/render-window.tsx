import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootStore } from './store/root-store';
import { RootStoreContext } from './store/root-store-context';
import './i18n';
import './styles/index.scss';

/**
 * Boots one Tauri window. Every window is its own Vite entry (`main.html`,
 * `overlay.html`, `hud.html`) so each page bundles only its own shell — the
 * overlay never loads the settings UI it does not draw. `remote.html` has an
 * entry of its own too, but no Tauri, so it does not come through here.
 */
export const renderWindow = (shell: React.ReactNode) => {
  const rootStore = new RootStore();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootStoreContext.Provider value={rootStore}>
        {shell}
      </RootStoreContext.Provider>
    </React.StrictMode>
  );
};
