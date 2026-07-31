/**
 * Derives the site's canonical public origin by tallying the origins real
 * visitors actually request it through. Background tasks (the QR-expiry reminder
 * scheduler) have no HTTP request of their own to read a `Host` header from, so
 * instead of a static `SITE_URL` env we observe traffic: every request increments
 * a counter for `${proto}://${host}`, and {@link getSiteOrigin} returns the
 * most-observed origin. `SITE_URL` remains as a cold-start seed until traffic
 * has been seen.
 *
 * The tally is in-memory (incremented per request — cheap) and periodically
 * flushed to `AppSetting` (`site.originTally`) so it survives restarts and
 * accumulates over time. Only public-looking hosts count — localhost, private
 * IPs, and LAN/bare hostnames are filtered so dev/tunnel/internal probes can't
 * win. All best-effort: nothing here may throw and break a request.
 */
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { AppSetting } from '#server/entities/appSetting.entity'
import { isSecureRequest } from './request'

const SETTING_KEY = 'site.originTally'
const FLUSH_MS = 5 * 60 * 1000
// Cap stored origins so a flood of spoofed Host headers can't grow the row
// without bound — keep only the most-observed few.
const MAX_ORIGINS = 32

const tally = new Map<string, number>()
let loaded = false
let dirty = false

/** True for a real public hostname. Rejects localhost, IP literals, private
 * ranges, and dotless LAN/bare hostnames so only genuine domains accumulate. */
function isPublicHost(host: string): boolean {
  if (!host) return false
  const h = host.toLowerCase().trim()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return false
  if (/^\[?[0-9a-f:.]+\]?$/.test(h)) return false // IPv4 / IPv6 literal
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false // private
  return h.includes('.') // a domain has at least one dot
}

/** Build `${proto}://${host}` for a request, or null if it isn't a public host. */
function deriveOrigin(event: H3Event): string | null {
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || ''
  if (!isPublicHost(host)) return null
  const proto = isSecureRequest(event) ? 'https' : 'http'
  return `${proto}://${host}`
}

/** Lazily merge the persisted tally into memory (once, idempotent under races). */
async function ensureLoaded(): Promise<void> {
  if (loaded || !AppDataSource.isInitialized) return
  loaded = true // set synchronously so concurrent callers don't re-read
  try {
    const row = await AppDataSource.getRepository(AppSetting).findOneBy({ key: SETTING_KEY })
    if (row?.value) {
      const data = JSON.parse(row.value) as Record<string, number>
      for (const [k, v] of Object.entries(data))
        if (typeof v === 'number') tally.set(k, (tally.get(k) ?? 0) + v)
    }
  } catch {
    // corrupt/missing row — start fresh
  }
}

/** Record a visitor's origin. Fire-and-forget; never throws. */
export async function recordOrigin(event: H3Event): Promise<void> {
  try {
    const origin = deriveOrigin(event)
    if (!origin) return
    if (!loaded) await ensureLoaded()
    tally.set(origin, (tally.get(origin) ?? 0) + 1)
    dirty = true
  } catch {
    // analytics must never break a request
  }
}

/**
 * The canonical public origin = the most-observed visitor origin. Falls back to
 * the `SITE_URL` env seed when no traffic has been observed yet, then ''.
 */
export async function getSiteOrigin(): Promise<string> {
  await ensureLoaded()
  let best = ''
  let bestN = 0
  for (const [origin, n] of tally) if (n > bestN) ((best = origin), (bestN = n))
  return best || ((useRuntimeConfig().siteUrl as string | undefined) ?? '')
}

/** Persist the in-memory tally (top N) so it survives restarts. Best-effort. */
export async function flushOriginTally(): Promise<void> {
  if (!AppDataSource.isInitialized) return
  if (!loaded) await ensureLoaded()
  if (!dirty) return
  dirty = false
  try {
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_ORIGINS)
    const value = JSON.stringify(Object.fromEntries(top))
    await AppDataSource.getRepository(AppSetting).save({ key: SETTING_KEY, value })
  } catch {
    // flush is best-effort
  }
}

/** Start the periodic flush timer. Unref'd so it never blocks shutdown. */
export function startOriginFlushTimer(): void {
  const t = setInterval(() => {
    void flushOriginTally().catch(() => {})
  }, FLUSH_MS)
  t.unref?.()
}
