import { MainRoot } from '@app/roots/main-root';
import { MainProvider } from '@app/store-providers';
import { MainWindow } from '@app/windows/main/MainWindow';
import { renderWindow } from './render-window';

const root = new MainRoot();

renderWindow(
  <MainProvider root={root}>
    <MainWindow />
  </MainProvider>
);
