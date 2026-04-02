import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const VALID_LANGS = ['ko', 'en', 'ja'];
const pathLang = window.location.pathname.split('/')[1];
const initialLang = VALID_LANGS.includes(pathLang) ? pathLang : 'ko';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: initialLang,
  fallbackLng: 'ko',
  supportedLngs: ['ko', 'en', 'ja'],
  interpolation: { escapeValue: false },
});

export default i18n;
