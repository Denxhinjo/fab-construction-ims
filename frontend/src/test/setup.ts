import '@testing-library/jest-dom'
// Initialize the real i18n instance so components using useTranslation()
// render actual copy instead of raw translation keys.
import i18n from '../i18n'

// Tests assert on English strings, so pin the language regardless of what
// localStorage (empty in jsdom) or the system locale would otherwise return.
i18n.changeLanguage('en')
