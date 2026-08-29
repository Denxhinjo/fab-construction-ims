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
    lng: localStorage.getItem('lang') ?? 'sq',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
