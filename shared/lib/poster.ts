import type { PosterSettings, SiteConfig } from '../types'

/**
 * Shared helpers for the share-poster generator (dashboard Share tab) — used
 * by BOTH the server-rendered poster endpoints (sharp) and the client-side
 * canvas renderer, so the two produce the same layout. Pure functions only.
 */
export const POSTER_W = 1080
export const POSTER_H = 1440
export const POSTER_THEMES = ['page', 'dark', 'light', 'primary'] as const
export type PosterTheme = (typeof POSTER_THEMES)[number]

export const DEFAULT_POSTER_SETTINGS: PosterSettings = {
  title: '',
  theme: 'page',
  fontSize: 60,
  width: POSTER_W,
  height: POSTER_H,
  border: 0,
  borderRadius: 28,
}

export function normalizePosterSettings(input: Partial<PosterSettings>): PosterSettings {
  const theme = String(input.theme ?? 'page')
  const number = (value: unknown, fallback: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback))
  return {
    title: String(input.title ?? '').trim(),
    theme: isPosterTheme(theme) ? theme : 'page',
    fontSize: number(input.fontSize, 60, 12, 180),
    width: number(input.width, POSTER_W, 240, POSTER_W),
    height: number(input.height, POSTER_H, 240, POSTER_H),
    border: number(input.border, 0, 0, 40),
    borderRadius: number(input.borderRadius, 28, 0, 120),
  }
}

/** QR card geometry — Microsoft-Forms portrait card: title in the upper third,
 * one large centered QR below, no URL text baked into the image. */
export const POSTER_QR_CARD = 600
export const POSTER_QR_TOP = 640
/** Vertical center of the title zone; lines are stacked around it. */
export const POSTER_TITLE_CENTER = 340

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
