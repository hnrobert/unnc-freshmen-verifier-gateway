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

/** Selectable QR-expiry reminder slots. Each fires on its respective day —
 * `-3d`/`-2d`/`-1d` = that many days before the org's `welcome.expiresAt`,
 * `day-of` = on `expiresAt` itself — at the recipient's own reminder time
 * (per-user preference; default 12:00 server-local). */
export type ReminderSlot = '-3d' | '-2d' | '-1d' | 'day-of'

/** All valid reminder slots (single source of truth for the UI, validator, scheduler). */
export const REMINDER_SLOTS: readonly ReminderSlot[] = ['-3d', '-2d', '-1d', 'day-of']

/**
 * Default maximum number of organizations a regular admin (`role: 'admin'`) may
 * create. A superadmin can raise (or lower) this per-user via the Users panel
 * (`User.orgLimit`); `null` on the user falls back to this default. Superadmins
 * themselves are always unlimited.
 */
export const DEFAULT_ADMIN_ORG_LIMIT = 3

/**
 * Org slug rules. Shared between the server (org create/rename), the old-slug
 * redirect middleware, and the client (new-org / rename forms) so every layer
 * validates against one source of truth.
 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

/** Top-level path segments that can never be an org slug (routes/files/reserved words). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'dashboard',
  'login',
  'register',
  'admin',
  'new',
  'www',
  'static',
  'assets',
  '_nuxt',
  'favicon.svg',
  'welcome',
])

/** Validate an org slug. Returns an error message, or null when valid. */
export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug))
    return 'Slug must be 3-32 chars: lowercase letters, digits, hyphens (no leading/trailing/consecutive hyphens).'
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved.`
  return null
}

/** An icon reference: an @lucide/vue (lucide) name, or an image URL/key for custom art. */
export interface IconSpec {
  /** An @lucide/vue (lucide) icon name, e.g. `"User"`, `"GraduationCap"`. */
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
  /** Primary theme color (hex), drives --primary/--ring CSS variables. Default #F7D447. */
  primaryColor?: string
}

export interface WelcomeAssetsConfig {
  /** Image shown atop the welcome page. `img:<key>` (DB image), public path, or URL. Omit for none. */
  image?: string
  /** CSS length constraining the image width, e.g. `"14rem"` or `"100%"`. */
  imageMaxWidth?: string
  /** CSS border-radius for the welcome image, e.g. `"0.5rem"` or `"50%"`. */
  imageRadius?: string
  /** If true, the welcome image gets a watermark of the visitor's name / email prefix. */
  watermark?: boolean
  /** Expiry date of the shared QR ('YYYY-MM-DD'). Auto-detected via OCR on upload,
   * manually editable. Reminder *schedules* are not org-level — each person picks
   * their own in their Notification preferences (see `shared/lib/reminderPref.ts`). */
  expiresAt?: string
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
