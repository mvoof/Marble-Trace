import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en.translation },
  ru: { translation: ru.translation },
  fr: { translation: fr.translation },
  es: { translation: es.translation },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // Default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  ns: ['translation'],
  defaultNS: 'translation',
});

export default i18n;
