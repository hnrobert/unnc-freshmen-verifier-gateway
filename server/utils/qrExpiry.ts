/**
 * Parse a QR-code expiry date out of OCR'd poster text. Recognises the
 * boilerplate WeChat/QQ group QRs print, e.g.:
 *   en: "Valid until 7/29 and will update upon joining group"
 *   zh: "该二维码7天内（7月30日前）有效，重新进入将更新"
 *
 * All dates are interpreted in the server's local timezone and returned at
 * local midnight (calendar day). Returns null when nothing reliable is found —
 * callers then fall back to manual entry.
 */

/** Format a Date as 'YYYY-MM-DD' in the server's local timezone. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localMidnight(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day, 0, 0, 0, 0)
}

/** Normalise a captured year (2-digit → 2000+, keep 4-digit as-is). */
function fixYear(y: number | undefined, fallback: number): number {
  if (y === undefined || !Number.isFinite(y)) return fallback
  if (y < 100) return 2000 + y
  return y
}

/**
 * Resolve month/day (+ optional year) to a Date, inferring the year: try the
 * given year; if that's more than a day in the past, roll forward a year (QR
 * codes are short-lived, so a past date almost certainly means next cycle). If
 * still in the past, give up. Invalid month/day → null.
 */
function resolveDate(month: number, day: number, year: number | undefined, now: Date): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const baseYear = fixYear(year, now.getFullYear())
  const candidate = localMidnight(baseYear, month, day)
  if (Number.isNaN(candidate.getTime())) return null
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (candidate.getTime() < yesterday.getTime()) {
    const next = localMidnight(baseYear + 1, month, day)
    if (next.getTime() < yesterday.getTime()) return null
    return next
  }
  return candidate
}

/** Parse the first recognisable expiry date from `text`, or null. */
export function parseExpiryFromText(text: string, now: Date = new Date()): Date | null {
  if (!text) return null

  // 1. Chinese absolute: "7月30日前" / "7 月 30 日" / "2026年7月30日". OCR often
  //    inserts spaces between characters and may garble the trailing 日, so the
  //    day marker is optional and all gaps tolerate whitespace.
  const zh = text.match(/(\d{2,4})?\s*年?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?/)
  if (zh) {
    const y = zh[1] ? parseInt(zh[1]!, 10) : undefined
    const d = resolveDate(parseInt(zh[2]!, 10), parseInt(zh[3]!, 10), y, now)
    if (d) return d
  }

  // 2. English "Valid until 7/29" or "Valid until 7/29/2026".
  const en = text.match(/valid\s+until\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/i)
  if (en) {
    const d = resolveDate(
      parseInt(en[1]!, 10),
      parseInt(en[2]!, 10),
      en[3] ? parseInt(en[3], 10) : undefined,
      now,
    )
    if (d) return d
  }

  // 3. Generic M/D or M/D/YYYY date anywhere in the text (last resort absolute).
  const slash = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/)
  if (slash) {
    const d = resolveDate(
      parseInt(slash[1]!, 10),
      parseInt(slash[2]!, 10),
      slash[3] ? parseInt(slash[3], 10) : undefined,
      now,
    )
    if (d) return d
  }

  // 4. Relative: "7天内" (zh, simp. 内 / trad. 內) / "within 7 days" (en) → now + N.
  const rel = text.match(/(\d+)\s*天\s*[内內]|within\s*(\d+)\s*days/i)
  if (rel) {
    const n = parseInt(rel[1] ?? rel[2] ?? '0', 10)
    if (n > 0 && n < 365) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n)
    }
  }

  return null
}
