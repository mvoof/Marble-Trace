import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainWindow } from './pages/MainWindow';
import { WidgetPage } from './pages/WidgetPage';
import './i18n';
import './styles/index.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainWindow />} />
        <Route path="/widget/:id" element={<WidgetPage />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
