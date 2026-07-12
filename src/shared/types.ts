/**
 * Shared types used by both the static SPA and the config CLI.
 *
 * Verification queries the live UNNC admission gateway (ported from the Python
 * `ref/client.py`) through a configurable CORS proxy. See {@link GatewayConfig}.
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

/** How verification resolves a name + ID. */
export type VerifyMode = 'live' | 'mock'

/**
 * Live-gateway configuration. The SPA ports `ref/client.py` and talks to the
 * admission portal through a CORS proxy (browsers cannot call the portal
 * directly — it does not send CORS headers).
 */
export interface GatewayConfig {
  /** `mock` short-circuits the portal and admits any well-formed input (UI preview). */
  mode: VerifyMode
  /**
   * How the SPA reaches the portal:
   *   - `'backend'` → SPA POSTs to {@link api} (a Node backend does the portal
   *     query server-side; no CORS, reliable). Default.
   *   - `'browser'` → SPA calls the portal itself through {@link proxy}
   *     (Vite dev proxy / host rewrite / remote CORS proxy).
   */
  transport: 'backend' | 'browser'
  /** Backend endpoint for `transport: 'backend'` (relative or absolute). */
  api: string
  /** Base URL of the admission portal. */
  baseUrl: string
  /**
   * Browser-transport proxy. A leading `/` is a same-origin prefix handled by the
   * Vite dev/preview proxy or a host rewrite (_redirects / vercel.json); a
   * `{url}` / `{urlEncoded}` template is a remote CORS proxy. Ignored for
   * `transport: 'backend'` (the backend calls the portal directly).
   */
  proxy: string
  /** Max captcha re-init rounds (the Python default is 6). */
  maxCaptchaRounds: number
  /** Max slider offsets tried per round (the Python default is 25). */
  maxOffsetTries: number
  /** Per-request fetch timeout in ms. */
  requestTimeoutMs: number
  /** `include` for cookie-relaying sticky proxies; `omit` otherwise. */
  credentials: 'include' | 'omit'
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
 * The full site configuration. `messages` is fed verbatim into vue-i18n, so the
 * message keys (e.g. `verify.nameLabel`, `welcome.body`) are the same keys used
 * by `t()` / templates in the SPA.
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
  /** Localized labels & content. Keys are referenced via `t('...')`. */
  messages: Record<Locale, Record<string, unknown>>
}
