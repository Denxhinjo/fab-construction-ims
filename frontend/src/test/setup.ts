import '@testing-library/jest-dom'
//this line loads the real i18n so components using useTranslation()
//render the actual text instead of raw translation keys
import i18n from '../i18n'

//this line pins the language to english because the tests check english text,
//whatever localStorage (empty in jsdom) or the system locale would return
i18n.changeLanguage('en')
