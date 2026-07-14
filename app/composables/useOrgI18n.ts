import { useI18n } from 'vue-i18n'
import type { Locale, SiteConfig } from '#shared/types'

const LOCALE_COOKIE = 'vg.locale'

/** Pick a locale from an Accept-Language / navigator.language string. */
function detectFromHeader(al: string | undefined, locales: Locale[]): Locale | null {
  if (!al) return null
  const primary = al.split(',')[0]?.trim().toLowerCase() ?? ''
  if (primary.startsWith('en') && locales.includes('en')) return 'en'
  if (primary.startsWith('zh') && locales.includes('zh')) return 'zh'
  return null
}

export function useOrgI18n() {
  // useScope: 'global' so the writer (applyOrgI18n) and the reader (LanguageToggle)
  // share the SAME reactive locale ref — no stale toggle state.
  const i18n = useI18n({ useScope: 'global' })
  const localeCookie = useCookie<Locale | null>(LOCALE_COOKIE, {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  /** Merge an org's messages without changing the active locale (for live preview). */
  function mergeOrgMessages(config: SiteConfig): void {
    for (const loc of config.locales) {
      i18n.mergeLocaleMessage(loc, config.messages[loc] as Record<string, unknown>)
    }
  }

  /**
   * Pick the initial locale for this org. Priority: the persisted cookie (read
   * server-side too) → the browser's language (Accept-Language on SSR,
   * navigator.language on client — they agree, so no flash) → the org default.
   * Pass `acceptLanguage` from the layout so SSR can detect without `navigator`.
   */
  function applyOrgI18n(config: SiteConfig, acceptLanguage?: string): void {
    mergeOrgMessages(config)

    let initial: Locale
    if (localeCookie.value && config.locales.includes(localeCookie.value)) {
      initial = localeCookie.value
    } else {
      const al = acceptLanguage ?? (import.meta.client ? navigator.language : '')
      initial = detectFromHeader(al, config.locales) ?? config.defaultLocale
    }

    i18n.locale.value = initial
    localeCookie.value = initial // persist so subsequent SSR renders agree
    if (import.meta.client) document.documentElement.lang = initial === 'zh' ? 'zh-CN' : 'en'
  }

  function setLocale(loc: Locale): void {
    i18n.locale.value = loc
    localeCookie.value = loc
    if (import.meta.client) document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en'
  }

  return { applyOrgI18n, mergeOrgMessages, setLocale }
}
