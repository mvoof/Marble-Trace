import { watchColdStart } from '@platform/sync/perf-cold-start';
import { OverlayRoot } from './store/overlay-root';
import {
  AppWindowContext,
  RendererCoreContext,
} from './store/root-store-context';
import { OverlayRootContext } from './store/overlay-root-context';
import { OverlayWindow } from './ui/app/overlay/OverlayWindow';
import { renderWindow } from './render-window';

watchColdStart();

const root = new OverlayRoot();

renderWindow(
  <RendererCoreContext.Provider value={root}>
    <AppWindowContext.Provider value={root}>
      <OverlayRootContext.Provider value={root}>
        <OverlayWindow />
      </OverlayRootContext.Provider>
    </AppWindowContext.Provider>
  </RendererCoreContext.Provider>
);
