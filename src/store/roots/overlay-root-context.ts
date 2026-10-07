import { createContext, use } from 'react';
import type { OverlayRoot } from './overlay-root';

/**
 * The overlay window's own root, for its shell alone: `OverlayWindow` hands it
 * to `initOverlaySync`. Components read their stores through the core and
 * app-window hooks in `root-store-context.ts`, which a preview can override.
 */
export const OverlayRootContext = createContext<OverlayRoot | null>(null);

export const useOverlayRoot = (): OverlayRoot => {
  const context = use(OverlayRootContext);

  if (!context) {
    throw new Error('Missing OverlayRootContext provider');
  }

  return context;
};
