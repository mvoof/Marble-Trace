import { createContext, use } from 'react';
import type { WidgetInstanceStore } from '@store/widget-runtime/widget-instances';

export const WidgetInstanceStoreContext =
  createContext<WidgetInstanceStore | null>(null);

/**
 * The store `mount.ts` built for the instance being rendered. Typed by the
 * caller — each widget wraps this in its own hook naming its store.
 */
export const useWidgetInstanceStore = <
  Store extends WidgetInstanceStore,
>(): Store => {
  const store = use(WidgetInstanceStoreContext);

  if (!store) {
    throw new Error(
      'useWidgetInstanceStore must be used inside a WidgetInstanceScope of a widget whose mount declares a store'
    );
  }

  return store as Store;
};
