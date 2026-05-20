import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainWindow } from './app/main/MainWindow';
import { OverlayWindow } from './app/overlay/OverlayWindow';
import './i18n';
import './styles/index.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainWindow />} />
        <Route path="/overlay" element={<OverlayWindow />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
