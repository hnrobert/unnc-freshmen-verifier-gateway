import type { Locale, SiteConfig } from '../types'
import defaultConfig from './defaultConfig'

/** Recursively fill empty-string leaves with default values. */
function deepFillDefaults(obj: Record<string, unknown>, defaults: Record<string, unknown>): void {
  for (const key of Object.keys(defaults)) {
    const dv = defaults[key]
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {}
      deepFillDefaults(obj[key] as Record<string, unknown>, dv as Record<string, unknown>)
    } else if (obj[key] === undefined || obj[key] === '' || obj[key] === null) {
      obj[key] = dv
    }
  }
}

/**
 * Fill any empty/missing string fields in the stored config with defaults from
 * defaultConfig. This lets the DB store only diffs (empty string = "use default")
 * while the public page always renders complete content.
 */
export function applyDefaults(config: SiteConfig): SiteConfig {
  const merged = JSON.parse(JSON.stringify(config)) as SiteConfig
  for (const locale of defaultConfig.locales) {
    if (!merged.messages[locale]) merged.messages[locale] = {}
    deepFillDefaults(
      merged.messages[locale] as Record<string, unknown>,
      defaultConfig.messages[locale] as Record<string, unknown>,
    )
  }
  return merged
}
