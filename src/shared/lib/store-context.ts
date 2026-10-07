import { createContext, use, type Context } from 'react';

/**
 * A React context holding one store, and the hook that reads it.
 *
 * Each store's context sits beside the store, so a component reaches it
 * without naming the window root that built it; the root's provider fills
 * every context from one core. A hook read where nothing provides its store
 * throws, naming the store — the window does not build it.
 */
export const createStoreContext = <Store>(
  storeName: string
): readonly [Context<Store | null>, () => Store] => {
  const StoreContext = createContext<Store | null>(null);

  const useProvidedStore = (): Store => {
    const store = use(StoreContext);

    if (!store) {
      throw new Error(`${storeName} is not provided in this window`);
    }

    return store;
  };

  return [StoreContext, useProvidedStore] as const;
};
