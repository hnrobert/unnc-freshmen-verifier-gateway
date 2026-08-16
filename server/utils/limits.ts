import { AppDataSource } from './database'
import { AppSetting } from '#server/entities/appSetting.entity'
import { DEFAULT_ADMIN_PAGE_LIMIT } from '#shared/types'

/**
 * App-wide default cap on the number of organizations a regular admin may
 * create, overridable per-user via `User.pageLimit` (null = use this default).
 * Stored in `app_settings` so a superadmin can tune it from the Users panel
 * without a code change. When unset, falls back to DEFAULT_ADMIN_PAGE_LIMIT.
 */
const SETTING_KEY = 'limits.adminOrgLimit'
const CACHE_TTL_MS = 30_000
let cache: { t: number; value: number } | null = null

/** Read the configured default admin page limit (in-process cached briefly). */
export async function getDefaultAdminPageLimit(): Promise<number> {
  if (cache && Date.now() - cache.t < CACHE_TTL_MS) return cache.value
  const row = await AppDataSource.getRepository(AppSetting).findOne({ where: { key: SETTING_KEY } })
  const value = parseLimit(row?.value)
  cache = { t: Date.now(), value }
  return value
}

/** Persist the default admin page limit and invalidate the cache. */
export async function setDefaultAdminPageLimit(limit: number): Promise<void> {
  await AppDataSource.getRepository(AppSetting).save({
    key: SETTING_KEY,
    value: JSON.stringify(limit),
  })
  cache = null
}

function parseLimit(raw: string | null | undefined): number {
  if (raw == null || raw === '') return DEFAULT_ADMIN_PAGE_LIMIT
  try {
    const n = JSON.parse(raw)
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_ADMIN_PAGE_LIMIT
  } catch {
    return DEFAULT_ADMIN_PAGE_LIMIT
  }
}
