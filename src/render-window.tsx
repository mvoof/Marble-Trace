import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './styles/index.scss';

/**
 * Boots one Tauri window. Every window is its own Vite entry (`main.html`,
 * `overlay.html`, `hud.html`) so each page bundles only its own shell — the
 * overlay never loads the settings UI it does not draw — and builds only its
 * own root (`MainRoot`, `OverlayRoot`, `HudRoot`), so it never constructs the
 * stores of another window either. The entry wraps the shell in the providers
 * its root fills. `remote.html` has an entry of its own too, but no Tauri, so
 * it does not come through here.
 */
export const renderWindow = (tree: React.ReactNode) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{tree}</React.StrictMode>
  );
};
