import type { ShareSettings, SiteConfig } from '../types'

/**
 * Shared helpers for the share-poster generator (dashboard Share tab) — used
 * by BOTH the server-rendered poster endpoints (sharp) and the client-side
 * canvas renderer, so the two produce the same layout. Pure functions only.
 */
export const POSTER_W = 1080
export const POSTER_H = 1440
export const POSTER_THEMES = ['page', 'dark', 'light', 'primary'] as const
export type PosterTheme = (typeof POSTER_THEMES)[number]

/** QR card geometry — Microsoft-Forms portrait card: title in the upper third,
 * one large centered QR below, no URL text baked into the image. */
export const POSTER_QR_CARD = 600
export const POSTER_QR_TOP = 640
/** Vertical center of the title zone; lines are stacked around it. */
export const POSTER_TITLE_CENTER = 340

/** Saved Share-tab defaults (page_share_settings) — one shape for the
 * dashboard form, the PUT endpoint, and both poster endpoints. */
export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  title: '',
  fontSize: 60,
  width: 480,
  height: 680,
  borderWidth: 0,
  borderRadius: 12,
}

/** Clamp arbitrary input (API body, query params, form refs) into a valid
 * ShareSettings — the single place the numeric ranges live, so the client
 * canvas, the PUT validation, and the server render can never disagree.
 * Keys are constrained but values may be anything (query strings, etc.). */
export function normalizeShareSettings(
  input: Partial<{ [K in keyof ShareSettings]: unknown }>,
): ShareSettings {
  const clamp = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value)
    return Math.round(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback)
  }
  return {
    title: String(input.title ?? '').trim(),
    fontSize: clamp(input.fontSize, DEFAULT_SHARE_SETTINGS.fontSize, 20, 160),
    width: clamp(input.width, DEFAULT_SHARE_SETTINGS.width, 240, 1920),
    height: clamp(input.height, DEFAULT_SHARE_SETTINGS.height, 240, 2160),
    borderWidth: clamp(input.borderWidth, DEFAULT_SHARE_SETTINGS.borderWidth, 0, 20),
    borderRadius: clamp(input.borderRadius, DEFAULT_SHARE_SETTINGS.borderRadius, 0, 160),
  }
}

export function isPosterTheme(v: string): v is PosterTheme {
  return (POSTER_THEMES as readonly string[]).includes(v)
}

/** Title fallback chain: ?title= → config.share.posterTitle → the page's
 * default-locale brand title → the page name. */
export function resolvePosterTitle(
  queryTitle: string | undefined,
  config: SiteConfig,
  pageName: string,
): string {
  const q = (queryTitle ?? '').trim()
  if (q) return q
  const stored = (config.share?.posterTitle ?? '').trim()
  if (stored) return stored
  const brandTitle = ((config.messages[config.defaultLocale]?.brand ?? {}) as { title?: string })
    .title
  return (brandTitle ?? '').trim() || pageName
}

/** XML/HTML-escape text for embedding in SVG markup. */
export function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Greedy width-based line wrap for the poster title (neither SVG <text> nor a
 * bare string knows pixel widths). Width estimation: CJK/fullwidth glyphs ≈ 1
 * em, everything else ≈ 0.55 em. Returns at most `maxLines` lines; an
 * over-long title is ellipsised. Mirrored by the canvas renderer.
 */
export function wrapTitle(
  title: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const emWidth = (ch: string): number => (/[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch) ? 1 : 0.55)
  const lines: string[] = []
  let current = ''
  let width = 0
  for (const ch of title) {
    const w = emWidth(ch) * fontSize
    if (width + w > maxWidth && current) {
      lines.push(current)
      current = ch
      width = w
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, -1) + '…'
        return lines
      }
    } else {
      current += ch
      width += w
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

/** Palette per theme — text colors that stay readable on each background. */
export function posterPalette(theme: PosterTheme, primaryColor: string) {
  if (theme === 'light') return { text: '#1c1917', sub: 'rgba(28,25,23,.65)', bg: '#f5f5f5' }
  if (theme === 'primary') return { text: '#ffffff', sub: 'rgba(255,255,255,.8)', bg: '#111111' }
  return { text: '#ffffff', sub: 'rgba(255,255,255,.78)', bg: '#171717' } // page(bg image)/dark
}
