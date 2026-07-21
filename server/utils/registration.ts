import picomatch from 'picomatch'
import { AppDataSource } from './database'
import { AppSetting } from '#server/entities/appSetting.entity'

/**
 * Superadmin-controlled registration email whitelist. Glob patterns (picomatch)
 * such as `*@nottingham.edu.cn`, `*@*.nottingham.edu.cn`, `{john,jane}@x.com`.
 * When enabled, an email must match at least one pattern to register. The very
 * first registration (superadmin bootstrap) always bypasses it — see
 * register.post.ts — so an enabled+empty whitelist can't lock the app out.
 */
export interface WhitelistConfig {
  enabled: boolean
  patterns: string[]
}

const SETTING_KEY = 'registration.emailWhitelist'
const DEFAULT_CONFIG: WhitelistConfig = { enabled: false, patterns: [] }
const CACHE_TTL_MS = 30_000
let cache: { t: number; cfg: WhitelistConfig } | null = null

/** Read the whitelist (in-process cached for CACHE_TTL_MS). */
export async function getEmailWhitelist(): Promise<WhitelistConfig> {
  if (cache && Date.now() - cache.t < CACHE_TTL_MS) return cache.cfg
  const row = await AppDataSource.getRepository(AppSetting).findOne({ where: { key: SETTING_KEY } })
  const cfg = row ? normalize(row.value) : { ...DEFAULT_CONFIG }
  cache = { t: Date.now(), cfg }
  return cfg
}

/** Persist the whitelist and invalidate the cache. */
export async function setEmailWhitelist(cfg: WhitelistConfig): Promise<void> {
  const normalized = normalize(JSON.stringify(cfg))
  await AppDataSource.getRepository(AppSetting).save({
    key: SETTING_KEY,
    value: JSON.stringify(normalized),
  })
  cache = null
}

function normalize(raw: string): WhitelistConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
  const enabled = Boolean((parsed as Partial<WhitelistConfig>)?.enabled)
  const patterns = Array.isArray((parsed as { patterns?: unknown[] })?.patterns)
    ? (parsed as { patterns: unknown[] }).patterns
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p.length > 0)
    : []
  return { enabled, patterns }
}

/** True if `email` matches any pattern (case-insensitive). Empty list never matches. */
export function emailMatchesWhitelist(email: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  return picomatch.isMatch(email.toLowerCase(), patterns, { nocase: true })
}
