import { watchColdStart } from '@app/sync/perf-cold-start';
import { OverlayRoot } from '@app/roots/overlay-root';
import { AppWindowProvider, CoreProvider } from '@app/store-providers';
import { OverlayRootContext } from '@app/roots/overlay-root-context';
import { OverlayWindow } from '@app/windows/overlay/OverlayWindow';
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
