import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enMainApp from './locales/en/main-app.json';
import enWidgets from './locales/en/widgets.json';
import ruMainApp from './locales/ru/main-app.json';
import ruWidgets from './locales/ru/widgets.json';
import zhMainApp from './locales/zh/main-app.json';
import zhWidgets from './locales/zh/widgets.json';

const resources = {
  en: { 'main-app': enMainApp, widgets: enWidgets },
  ru: { 'main-app': ruMainApp, widgets: ruWidgets },
  zh: { 'main-app': zhMainApp, widgets: zhWidgets },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'ru', 'zh'],
  interpolation: {
    escapeValue: false,
  },
  ns: ['main-app', 'widgets'],
  defaultNS: 'main-app',
});

export default i18n;
