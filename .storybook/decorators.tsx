import React from 'react';
import { runInAction } from 'mobx';
import type { Decorator } from '@storybook/react';
import { RootStore } from '../src/store/root-store';
import { RootStoreContext } from '../src/store/root-store-context';

export const withStore =
  (seedFn?: (store: RootStore) => void): Decorator =>
  (Story) => {
    const store = React.useMemo(() => new RootStore({ skipInit: true }), []);

    React.useLayoutEffect(() => {
      if (seedFn) {
        runInAction(() => seedFn(store));
      }
    }, [store]);

    return (
      <RootStoreContext.Provider value={store}>
        <Story />
      </RootStoreContext.Provider>
    );
  };
