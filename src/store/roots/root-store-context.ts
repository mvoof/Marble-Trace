import { createContext, use } from 'react';
import type { RendererCore } from './renderer-core';

/**
 * The whole core, for the window shells and Storybook alone. Components read
 * the store they need through its own hook beside the store
 * (`usePlayerStore` in `store/data/player-context.ts`, …); the window's
 * provider (`ui/app/store-providers.tsx`) fills every one of them from this
 * same core, and a preview overrides them all with its `PreviewCore`.
 */
export const RendererCoreContext = createContext<RendererCore | null>(null);

export const useStore = (): RendererCore => {
  const context = use(RendererCoreContext);

  if (!context) {
    throw new Error('Missing RendererCoreContext provider');
  }

  return context;
};
