import React from 'react';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { invoke } from '@tauri-apps/api/core';

const languages = ['en', 'fr', 'es', 'ru'] as const;
type AllLangType = (typeof languages)[number];

const App = () => {
  const { t } = useTranslation();

  const [appLang, setAppLang] = useState<AllLangType>('en');

  useEffect(() => {
    i18n.changeLanguage(appLang);
  }, [appLang]);

  const handleAppLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.currentTarget.value as AllLangType;

    invoke<AllLangType>('get_lang_from_rust', { lang }).then((langFromRust) =>
      setAppLang(langFromRust)
    );
  };

  return (
    <div>
      <h1>{t('welcome')}!</h1>

      <label htmlFor="app-language-select">{t('changeLanguage')}:&nbsp;</label>

      <select
        id="app-language-select"
        value={appLang}
        onChange={handleAppLanguageChange}
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
};

export default App;
