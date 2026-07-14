import type { Locale, SiteConfig } from '../types'

/** Dotted i18n keys every org must provide for every enabled locale. */
export const REQUIRED_KEYS = [
  'brand.title',
  'brand.subtitle',
  'verify.heading',
  'verify.subheading',
  'verify.nameLabel',
  'verify.namePlaceholder',
  'verify.idLabel',
  'verify.idPlaceholder',
  'verify.submit',
  'verify.submitting',
  'verify.hint',
  'errors.emptyName',
  'errors.badIdFormat',
  'errors.notAdmitted',
  'errors.captcha',
  'errors.network',
  'errors.generic',
  'admission.title',
  'admission.name',
  'admission.university',
  'admission.date',
  'admission.detail',
  'welcome.badge',
  'welcome.title',
  'welcome.body',
  'welcome.imageAlt',
  'welcome.back',
  'theme.toggle',
  'lang.label',
  'footer',
]

function deepGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** Validate a SiteConfig draft; returns a list of human-readable problems. */
export function validateConfig(config: SiteConfig): string[] {
  const errors: string[] = []

  if (!config.locales || config.locales.length === 0) errors.push('locales is empty')
  if (!config.defaultLocale) errors.push('defaultLocale is missing')
  else if (!config.locales?.includes(config.defaultLocale)) {
    errors.push(`defaultLocale "${config.defaultLocale}" is not listed in locales`)
  }

  const g = config.gateway
  if (!g) {
    errors.push('gateway is missing')
  } else {
    if (!['live', 'mock'].includes(g.mode)) errors.push(`gateway.mode must be 'live' or 'mock'`)
    if (!g.baseUrl || !/^https?:\/\//.test(g.baseUrl)) {
      errors.push('gateway.baseUrl must be an http(s) URL')
    }
    if (!Number.isFinite(g.maxCaptchaRounds) || g.maxCaptchaRounds < 1) {
      errors.push('gateway.maxCaptchaRounds must be >= 1')
    }
    if (!Number.isFinite(g.maxOffsetTries) || g.maxOffsetTries < 1) {
      errors.push('gateway.maxOffsetTries must be >= 1')
    }
  }

  if (!config.messages) errors.push('messages is missing')

  for (const loc of config.locales ?? []) {
    const messages = config.messages[loc as Locale]
    if (!messages) {
      errors.push(`messages.${loc} is missing`)
      continue
    }
    for (const key of REQUIRED_KEYS) {
      const value = deepGet(messages, key)
      if (value === undefined || value === null || value === '') {
        errors.push(`messages.${loc}.${key} is missing`)
      }
    }
  }

  return errors
}
