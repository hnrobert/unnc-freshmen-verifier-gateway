import { AppDataSource } from './database'
import { AppSetting } from '#server/entities/appSetting.entity'

/**
 * Superadmin-controlled site-wide verification switches (admin panel →
 * Verification). Stored in `app_settings` like the registration whitelist.
 *
 *  • `freshmanEnabled` — master switch for the freshman (name + ID) verify
 *    flow. When off, the tab is hidden and `/check` is refused site-wide.
 *  • `emailModes` — which public email flows are enabled (multi-select):
 *      'welcome' — mails the welcome content directly (legacy).
 *      'code'    — email + 6-digit code; success issues a 30-day verify cookie
 *                  (same trust JWT the freshman flow uses).
 *    Both, one, or neither may be enabled. With both, the public page shows a
 *    flow selector in the email tab; with exactly one it goes straight to that
 *    flow; with none the email tab is hidden.
 */
export type EmailMode = 'welcome' | 'code'
export const EMAIL_MODES: readonly EmailMode[] = ['welcome', 'code']

export interface VerificationSettings {
  freshmanEnabled: boolean
  emailModes: EmailMode[]
}

const SETTING_KEY = 'verification.gateways'
const DEFAULTS: VerificationSettings = { freshmanEnabled: true, emailModes: ['welcome'] }
const CACHE_TTL_MS = 30_000
let cache: { t: number; cfg: VerificationSettings } | null = null

function normalize(raw: string | undefined | null): VerificationSettings {
  try {
    const parsed = JSON.parse(raw ?? '') as Partial<VerificationSettings> & {
      // legacy single-choice value from before the multi-select
      emailMode?: string
    }
    const valid = new Set<string>(EMAIL_MODES)
    if (Array.isArray(parsed.emailModes)) {
      // An explicitly stored array is authoritative — INCLUDING the empty one
      // (the admin unchecked both, meaning the email tab is off).
      const modes = parsed.emailModes.filter((m): m is EmailMode => valid.has(m))
      return {
        freshmanEnabled: parsed.freshmanEnabled === undefined ? true : !!parsed.freshmanEnabled,
        emailModes: modes,
      }
    }
    // Legacy single-choice value, or no email field at all → default.
    let modes: EmailMode[] = DEFAULTS.emailModes.slice()
    if (typeof parsed.emailMode === 'string' && valid.has(parsed.emailMode)) {
      modes = [parsed.emailMode as EmailMode]
    }
    return {
      freshmanEnabled: parsed.freshmanEnabled === undefined ? true : !!parsed.freshmanEnabled,
      emailModes: modes,
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
