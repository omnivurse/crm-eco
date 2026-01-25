// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

const saved = localStorage.getItem('i18n_lang') || 'en';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: saved,
    fallbackLng: 'en',
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    backend: { loadPath: '/locales/{{lng}}/translation.json' },
    returnNull: false,
    debug: import.meta.env.DEV === true,
    react: { useSuspense: false },
  });

export default i18n;