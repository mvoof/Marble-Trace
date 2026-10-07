import { MainRoot } from './store/roots/main-root';
import { MainRootContext } from './store/roots/main-root-context';
import {
  AppWindowContext,
  RendererCoreContext,
} from './store/roots/root-store-context';
import { MainWindow } from './ui/app/main/MainWindow';
import { renderWindow } from './render-window';

const root = new MainRoot();

renderWindow(
  <RendererCoreContext.Provider value={root}>
    <AppWindowContext.Provider value={root}>
      <MainRootContext.Provider value={root}>
        <MainWindow />
      </MainRootContext.Provider>
    </AppWindowContext.Provider>
  </RendererCoreContext.Provider>
);
