import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

export const supportedLocales = ['ru', 'en']
const localeStorageKey = 'locale'

const getSystemLocale = () => {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  return languages.some((language) => language?.toLowerCase().startsWith('ru')) ? 'ru' : 'en'
}

const getInitialLocale = () => {
  if (typeof localStorage !== 'undefined') {
    const savedLocale = localStorage.getItem(localeStorageKey)
    if (supportedLocales.includes(savedLocale)) {
      return savedLocale
    }
  }

  return getSystemLocale()
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: { ru, en }
})

export const saveLocale = (locale) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(localeStorageKey, locale)
  }
}
