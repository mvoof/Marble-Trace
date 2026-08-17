import { createContext, useContext } from 'react';

import type { RemoteScreenStore } from '@store/remote/remote-screen.store';

/**
 * Only the remote entry point provides this. Kept out of `RootStore` on
 * purpose: the main window and the overlay windows have no remote screen, and
 * a store nobody there can use has no business hanging off the root.
 */
export const RemoteScreenContext = createContext<RemoteScreenStore | null>(
  null
);

export const useRemoteScreenStore = (): RemoteScreenStore => {
  const store = useContext(RemoteScreenContext);

  if (!store) {
    throw new Error('useRemoteScreenStore used outside a remote screen');
  }

  return store;
};
