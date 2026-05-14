import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainWindow } from './pages/MainWindow/MainWindow';
import { OverlayWindow } from './pages/OverlayPage/OverlayWindow';
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
