import React from 'react';
import { runInAction } from 'mobx';
import type { Decorator } from '@storybook/react';
import { PreviewCore } from '../src/store/roots/renderer-core';
import { useStore } from '../src/store/roots/root-store-context';
import { CoreProvider } from '../src/ui/app/store-providers';

export const withStore =
  (seedFn?: (store: PreviewCore) => void): Decorator =>
  (Story) => {
    const store = React.useMemo(() => new PreviewCore(), []);

    React.useLayoutEffect(() => {
      if (seedFn) {
        runInAction(() => seedFn(store));
      }
    }, [store]);

    return (
      <CoreProvider core={store}>
        <Story />
      </CoreProvider>
    );
  };

/**
 * The story's store, as `withStore` built it. The context is typed for any
 * core; under a story it always holds a `PreviewCore`, which may write.
 */
export const usePreviewStore = (): PreviewCore => useStore() as PreviewCore;
