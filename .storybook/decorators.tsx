import React from 'react';
import { runInAction } from 'mobx';
import type { Decorator } from '@storybook/react';
import { RendererCore } from '../src/store/renderer-core';
import { RendererCoreContext } from '../src/store/root-store-context';

export const withStore =
  (seedFn?: (store: RendererCore) => void): Decorator =>
  (Story) => {
    const store = React.useMemo(() => new RendererCore({ skipInit: true }), []);

    React.useLayoutEffect(() => {
      if (seedFn) {
        runInAction(() => seedFn(store));
      }
    }, [store]);

    return (
      <RendererCoreContext.Provider value={store}>
        <Story />
      </RendererCoreContext.Provider>
    );
  };
