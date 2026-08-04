import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import sq from './locales/sq.json'
import en from './locales/en.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      sq: { translation: sq },
      en: { translation: en },
    },
    // Default to English for first-time visitors -- Albanian stays fully
    // supported and one toggle away, but a brand-new visitor shouldn't land
    // on a non-English screen by default.
    lng: localStorage.getItem('lang') ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
