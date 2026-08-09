import { readFileSync } from 'node:fs'
import { isValidTz } from '#shared/lib/reminderTz'

/**
 * The server's local timezone — the default reminder timezone and the zone
 * shown in the org editor's server-clock readout. Resolved once (cached) from
 * the most authoritative available source, first valid wins:
 *
 *   1. `TZ` env var
 *   2. `/etc/timezone` — the plain-text IANA zone written by Debian/Ubuntu
 *      `tzdata` (and bind-mountable into a container). This is the reliable
 *      source on hosts whose `/etc/localtime` is a *regular file* rather than a
 *      symlink: ICU can read such a file for offsets but can't derive the zone
 *      name from it, so `Intl` (step 3) returns "UTC" silently.
 *   3. `Intl.DateTimeFormat().resolvedOptions().timeZone` — reads `TZ` then the
 *      system zone; works where `/etc/localtime` is a symlink (Alpine, macOS).
 *   4. "UTC" — last resort.
 *
 * The choice and its source are logged once so a silent-UTC misconfiguration is
 * visible (e.g. neither `TZ`, `/etc/timezone`, nor a resolvable localtime).
 */
let cache: string | null = null

export function resolveServerTz(): string {
  if (cache !== null) return cache

  const candidates: Array<{ tz: string; src: string }> = []
  const envTz = process.env.TZ?.trim()
  if (envTz) candidates.push({ tz: envTz, src: 'TZ env' })
  try {
    const fileTz = readFileSync('/etc/timezone', 'utf8').trim()
    if (fileTz) candidates.push({ tz: fileTz, src: '/etc/timezone' })
  } catch {
    /* absent on some hosts (Alpine, macOS) — Intl below handles those */
  }
  candidates.push({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    src: 'Intl',
  })

  const picked = candidates.find((c) => isValidTz(c.tz)) ?? { tz: 'UTC', src: 'fallback' }
  cache = picked.tz
  console.log(`[server] timezone resolved: ${picked.tz} (via ${picked.src})`)
  return cache
}
