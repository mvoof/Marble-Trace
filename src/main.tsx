import { MainRoot } from './store/roots/main-root';
import { MainProvider } from './ui/app/store-providers';
import { MainWindow } from './ui/app/main/MainWindow';
import { renderWindow } from './render-window';

const root = new MainRoot();

renderWindow(
  <MainProvider root={root}>
    <MainWindow />
  </MainProvider>
);
