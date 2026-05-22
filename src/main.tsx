import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainWindow } from './app/main/MainWindow';
import { OverlayWindow } from './app/overlay/OverlayWindow';
import { RootStore } from './store/root-store';
import { RootStoreContext } from './store/root-store-context';
import './i18n';
import './styles/index.scss';

const rootStore = new RootStore();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootStoreContext.Provider value={rootStore}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainWindow />} />
          <Route path="/overlay" element={<OverlayWindow />} />
        </Routes>
      </HashRouter>
    </RootStoreContext.Provider>
  </React.StrictMode>
);
