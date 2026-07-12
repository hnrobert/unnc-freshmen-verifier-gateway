/**
 * Shared types used by both the static SPA and the config CLI.
 *
 * Everything the user can customize flows through {@link SiteConfig}. Edit
 * `config/site.config.ts` to rebrand the gateway — no component code changes
 * required.
 */

/** Locales supported by the gateway. Extend here + add messages to support more. */
export type Locale = 'zh' | 'en'

/** A string available in every supported locale. */
export type Localized<T = string> = Record<Locale, T>

/** An icon reference: a lucide-vue-next name, or an image URL for custom art. */
export interface IconSpec {
  /** A lucide-vue-next icon name, e.g. `"User"`, `"GraduationCap"`. */
  lucide?: string
  /** An image used instead of an icon — public path (`"/x.svg"`) or remote URL. */
  img?: string
}

/** Convenience alias — most icons are just a lucide name string. */
export type IconRef = string | IconSpec

/** Semantic icon slots; customize every icon shown across both pages here. */
export interface IconsConfig {
  brand: IconRef
  nameField: IconRef
  idField: IconRef
  submit: IconRef
  verifying: IconRef
  welcome: IconRef
  back: IconRef
  toggleLanguage: IconRef
  toggleTheme: IconRef
  error: IconRef
  success: IconRef
}

export interface ThemeConfig {
  /** Base border radius, e.g. `"0.65rem"`. Drives the `--radius` CSS variable. */
  radius: string
}

export interface WelcomeAssetsConfig {
  /** Image shown atop the welcome page. Public path or remote URL. Omit for none. */
  image?: string
  /** CSS length constraining the image width, e.g. `"14rem"` or `"100%"`. */
  imageMaxWidth?: string
  /** Whether the image should be circular (avatar style). */
  imageRounded?: boolean
}

/** A single verifiable person from the students source file. */
export interface StudentEntry {
  name: string
  idNumber: string
}

/**
 * The full site configuration. `messages` is fed verbatim into vue-i18n, so the
 * message keys (e.g. `verify.nameLabel`, `welcome.body`) are the same keys used
 * by `t()` / templates in the SPA.
 */
export interface SiteConfig {
  /** Supported locales; the first is used as a fallback. */
  locales: Locale[]
  /** Locale used before the visitor picks one. */
  defaultLocale: Locale
  /**
   * Salt mixed into every `name|id` hash. Change this for your deployment so the
   * bundled hashes are not reusable elsewhere. Must match between `gen` and the
   * SPA (both read this same file).
   */
  salt: string
  icons: IconsConfig
  theme: ThemeConfig
  welcome: WelcomeAssetsConfig
  /** Localized labels & content. Keys are referenced via `t('...')`. */
  messages: Record<Locale, Record<string, unknown>>
}
