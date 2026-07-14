import { useI18n } from 'vue-i18n'
import type { Locale, SiteConfig } from '#shared/types'

const LOCALE_KEY = 'vg.locale'

/** Merge an org's messages into vue-i18n and pick the initial locale. */
export function useOrgI18n() {
  const i18n = useI18n()

  function applyOrgI18n(config: SiteConfig): void {
    mergeOrgMessages(config)
    let initial = config.defaultLocale
    if (import.meta.client) {
      const stored = localStorage.getItem(LOCALE_KEY) as Locale | null
      if (stored && config.locales.includes(stored)) initial = stored
      else if (
        config.locales.includes('en') &&
        navigator.language.toLowerCase().startsWith('en')
      ) {
        initial = 'en'
      }
    }
    i18n.locale.value = initial
    if (import.meta.client) document.documentElement.lang = initial === 'zh' ? 'zh-CN' : 'en'
  }

  /** Merge an org's messages without changing the active locale (for live preview). */
  function mergeOrgMessages(config: SiteConfig): void {
    for (const loc of config.locales) {
      i18n.mergeLocaleMessage(loc, config.messages[loc] as Record<string, unknown>)
    }
  }

  function setLocale(loc: Locale): void {
    i18n.locale.value = loc
    if (import.meta.client) {
      localStorage.setItem(LOCALE_KEY, loc)
      document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en'
    }
  }

  return { applyOrgI18n, mergeOrgMessages, setLocale }
}
