/**
 * Shared types used by both the Nuxt app and the Nitro server (the `shared/`
 * dir is the Nuxt 4 home for app↔server code). The admission portal is always
 * queried server-side (no CORS), so `GatewayConfig` carries no transport/api
 * fields.
 */

/** Locales supported by the gateway. Extend here + add messages to support more. */
export type Locale = 'zh' | 'en'

/** A string available in every supported locale. */
export type Localized<T = string> = Record<Locale, T>

/** An icon reference: a lucide-vue-next name, or an image URL/key for custom art. */
export interface IconSpec {
  /** A lucide-vue-next icon name, e.g. `"User"`, `"GraduationCap"`. */
  lucide?: string
  /** An image used instead of an icon — `img:<key>` (DB image) or a URL. */
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
  /** Image shown atop the welcome page. `img:<key>` (DB image), public path, or URL. Omit for none. */
  image?: string
  /** CSS length constraining the image width, e.g. `"14rem"` or `"100%"`. */
  imageMaxWidth?: string
  /** Whether the image should be circular (avatar style). */
  imageRounded?: boolean
}

/** Optional full-page background for the org's verify/welcome pages. */
export interface BackgroundConfig {
  /** Background image: `img:<key>` (DB image), public path, or URL. Omit/empty for no background. */
  image?: string
  /** Darkening overlay 0–1 (keeps text readable over busy images). */
  overlayOpacity?: number
}

/** How verification resolves a name + ID. */
export type VerifyMode = 'live' | 'mock'

/**
 * Per-org live-gateway configuration. The Nitro server queries the admission
 * portal directly (no CORS server-side), so there is no transport/proxy here.
 */
export interface GatewayConfig {
  /** `mock` short-circuits the portal and admits any well-formed input (UI preview). */
  mode: VerifyMode
  /** Base URL of the admission portal. */
  baseUrl: string
  /** Max captcha re-init rounds (the Python default is 6). */
  maxCaptchaRounds: number
  /** Max slider offsets tried per round (the Python default is 25). */
  maxOffsetTries: number
  /** Per-request fetch timeout in ms. */
  requestTimeoutMs: number
}

/** Decoded image (RGBA, row-major) used by the captcha offset ranker. */
export interface DecodedImage {
  width: number
  height: number
  /** RGBA bytes, length = width * height * 4. */
  data: Uint8ClampedArray
}

/** Result of an admission query (mirrors `ref/client.py` `AdmissionResult`). */
export interface AdmissionResult {
  ok: boolean
  /** `true` = admitted, `false` = not found, `null` = could not determine. */
  admitted: boolean | null
  message: string
  name?: string
  detail?: string
  university?: string
  date?: string
}

/**
 * The full per-org site configuration (one row in `org_settings`). `messages` is
 * fed verbatim into vue-i18n, so the message keys (e.g. `verify.nameLabel`) are
 * the same keys used by `t()` / templates. Images are referenced by `img:<key>`
 * and resolved to serving URLs at render time.
 */
export interface SiteConfig {
  /** Supported locales; the first is used as a fallback. */
  locales: Locale[]
  /** Locale used before the visitor picks one. */
  defaultLocale: Locale
  gateway: GatewayConfig
  icons: IconsConfig
  theme: ThemeConfig
  welcome: WelcomeAssetsConfig
  /** Optional full-page background image for the org's pages. */
  background?: BackgroundConfig
  /** Localized labels & content. Keys are referenced via `t('...')`. */
  messages: Record<Locale, Record<string, unknown>>
}
