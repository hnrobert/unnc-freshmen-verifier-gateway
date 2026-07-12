/**
 * vue-i18n instance, configured entirely from `config/site.config.ts`.
 *
 * `siteMessages` is exported so components can fetch raw message values that are
 * unsafe to route through `t()` (e.g. the markdown welcome body, which may
 * contain `{` characters that vue-i18n would try to interpolate).
 */
import { createI18n, type I18nOptions } from 'vue-i18n'
import siteConfig from '@config/site.config'
import type { Locale } from '@/shared/types'

const STORAGE_KEY = 'unnc-vg.locale'

/** Minimal view of vue-i18n's reactive global locale (a writable ref). */
type GlobalLocale = { locale: { value: string } }

function globalLocale(): GlobalLocale {
  return i18n.global as unknown as GlobalLocale
}

function detectInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && siteConfig.locales.includes(stored)) return stored
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('en')) return 'en'
    if (lang.startsWith('zh')) return 'zh'
  }
  return siteConfig.defaultLocale
}

export const siteMessages = siteConfig.messages

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectInitialLocale(),
  fallbackLocale: siteConfig.defaultLocale,
  availableLocales: siteConfig.locales,
  // Config messages are loosely typed; cast at the framework boundary.
  messages: siteConfig.messages as unknown as NonNullable<I18nOptions['messages']>,
})

/** Switch the active locale, persist the choice, and update `<html lang>`. */
export function setLocale(locale: Locale): void {
  globalLocale().locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore persistence errors */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }
}

// Keep <html lang> in sync with the detected locale on first load.
if (typeof document !== 'undefined') {
  const current = globalLocale().locale.value as Locale
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en'
}
