/**
 * Timezone helpers for the QR-expiry reminder schedule. Pure functions, zero
 * dependencies — kept in `shared/` so the self-test can exercise them without
 * pulling in the server (DB, nodemailer).
 *
 * The scheduler resolves a wall-clock time ("2026-08-08 12:00 in Asia/Shanghai")
 * to a UTC instant, so reminders fire at the configured time regardless of the
 * server's own timezone (e.g. a UTC host fires "12:00 Asia/Shanghai" at 04:00Z).
 */

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Offset (ms east of UTC) of `tz` at the given instant, via Intl. */
export function tzOffsetMs(tz: string, epochMs: number): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23', // avoid "24:00" for midnight
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date(epochMs))) p[part.type] = part.value
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!)
  return asUtc - epochMs
}

/** 'YYYY-MM-DD' + 'HH:MM' wall-clock in `tz` → epoch ms. DST-correct: starting
 * from the offset at the UTC-equal instant, the corrected target converges
 * after a couple of iterations. */
export function zonedDateTimeToUtcMs(dateStr: string, timeStr: string, tz: string): number {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number)
  const [hh = 0, mm = 0] = timeStr.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  let target = wall
  for (let i = 0; i < 3; i++) {
    const corrected = wall - tzOffsetMs(tz, target)
    if (corrected === target) break
    target = corrected
  }
  return target
}

/** 'YYYY-MM-DD' shifted by `days`, normalized across month/year boundaries
 * (e.g. '2026-08-01' − 2 → '2026-07-30'). Day arithmetic is timezone-independent. */
export function shiftCalendarDate(dateStr: string, days: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number)
  const cal = new Date(y, m - 1, d + days)
  return `${cal.getFullYear()}-${String(cal.getMonth() + 1).padStart(2, '0')}-${String(
    cal.getDate(),
  ).padStart(2, '0')}`
}
