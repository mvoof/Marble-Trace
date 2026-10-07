import { createContext, use } from 'react';
import type { MainRoot } from './main-root';

/**
 * The main window's whole root, for its shell alone (`MainWindow` starts the
 * window's sync with it). The stores only main builds have their own hooks
 * beside them, provided by `MainProvider`; outside the main window those
 * hooks throw on first render — and the overlay and widget folders may not
 * import them at all (`.oxlintrc.json`).
 */
export const MainRootContext = createContext<MainRoot | null>(null);

export const useMainRoot = (): MainRoot => {
  const context = use(MainRootContext);

  if (!context) {
    throw new Error('Missing MainRootContext provider');
  }

  return context;
};
