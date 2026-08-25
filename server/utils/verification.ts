import { AppDataSource } from './database'
import { AppSetting } from '#server/entities/appSetting.entity'

/**
 * Superadmin-controlled site-wide verification switches (admin panel →
 * Verification). Stored in `app_settings` like the registration whitelist.
 *
 *  • `freshmanEnabled` — master switch for the freshman (name + ID) verify
 *    flow. When off, the tab is hidden and `/check` is refused site-wide.
 *  • `emailMode` — what the public email tab does:
 *      'welcome' (default) — mails the welcome content directly (legacy).
 *      'code'    — email + 6-digit code; success issues a 30-day verify cookie
 *                  (same trust JWT the freshman flow uses).
 */
export type EmailMode = 'welcome' | 'code'

export interface VerificationSettings {
  freshmanEnabled: boolean
  emailMode: EmailMode
}

const SETTING_KEY = 'verification.gateways'
const DEFAULTS: VerificationSettings = { freshmanEnabled: true, emailMode: 'welcome' }
const CACHE_TTL_MS = 30_000
let cache: { t: number; cfg: VerificationSettings } | null = null

function normalize(raw: string | undefined | null): VerificationSettings {
  try {
    const parsed = JSON.parse(raw ?? '') as Partial<VerificationSettings>
    return {
      freshmanEnabled: parsed.freshmanEnabled === undefined ? true : !!parsed.freshmanEnabled,
      emailMode: parsed.emailMode === 'code' ? 'code' : 'welcome',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Read the settings (in-process cached, 30s). */
export async function getVerificationSettings(): Promise<VerificationSettings> {
  if (cache && Date.now() - cache.t < CACHE_TTL_MS) return cache.cfg
  const row = await AppDataSource.getRepository(AppSetting).findOne({ where: { key: SETTING_KEY } })
  const cfg = normalize(row?.value)
  cache = { t: Date.now(), cfg }
  return cfg
}

/** Persist and invalidate the cache. */
export async function setVerificationSettings(cfg: VerificationSettings): Promise<void> {
  const normalized = normalize(JSON.stringify(cfg))
  await AppDataSource.getRepository(AppSetting).save({
    key: SETTING_KEY,
    value: JSON.stringify(normalized),
  })
  cache = null
}
