import { watchColdStart } from '@platform/sync/perf-cold-start';
import { OverlayRoot } from './store/roots/overlay-root';
import { AppWindowProvider, CoreProvider } from './ui/app/store-providers';
import { OverlayRootContext } from './store/roots/overlay-root-context';
import { OverlayWindow } from './ui/app/overlay/OverlayWindow';
import { renderWindow } from './render-window';

watchColdStart();

const root = new OverlayRoot();

renderWindow(
  <CoreProvider core={root}>
    <AppWindowProvider stores={root}>
      <OverlayRootContext.Provider value={root}>
        <OverlayWindow />
      </OverlayRootContext.Provider>
    </AppWindowProvider>
  </CoreProvider>
);
