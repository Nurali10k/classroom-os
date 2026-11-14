/**
 * i18n/config.js
 * Single i18next instance for the product. Locales are bundled as JSON so the
 * first paint is never blocked by a network round-trip, and the browser
 * language detector persists the user's pick under the same key the bootstrap
 * script in index.html reads.
 */

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import kg from './locales/kg.json'
import ru from './locales/ru.json'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES } from '../utils/constants'

export const SUPPORTED_LANGUAGES = LANGUAGES.map((language) => language.code)

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      kg: { translation: kg },
      en: { translation: en },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    // `ru-RU` collapses to `ru`; an unknown tag falls back to the default.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE
}

/** Keeps `<html lang>` honest for screen readers and CSS hyphenation. */
i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language
})

/** Switches language and persists the choice for the next session. */
export function setLanguage(code) {
  if (!SUPPORTED_LANGUAGES.includes(code)) return
  i18n.changeLanguage(code)
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  } catch {
    /* private mode — the session still switches, it just will not persist */
  }
}

export default i18n
