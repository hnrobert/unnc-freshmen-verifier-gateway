/**
 * Per-user reminder-preference resolution. Pure functions, zero IO — kept in
 * `shared/` so the scheduler (`server/utils/reminders.ts`), the self-service
 * notification API, and the dashboard UI read-out all derive the *same* effective
 * schedule from the same inputs.
 *
 * The model is user-centric: each person has an account-level default
 * (`User.{notifyExpiry, reminderSlots, reminderTime, tz}`) and may override it
 * per org (`UserOrgNotificationPref`). When neither is set, a system default
 * applies: `['-2d', '-1d', 'day-of']` at 12:00 in the server's timezone. The
 * org has no say in the schedule — only `welcome.expiresAt` (the date itself)
 * is org-level. See {@link resolveEffectivePref} for the exact tier chain.
 */
import { REMINDER_SLOTS, type ReminderSlot } from '../types'
import { isValidTz } from './reminderTz'

/** System-wide fallback schedule when nothing is configured anywhere:
 * 2 days before, 1 day before, and on the day — at noon, server timezone. */
export const SYSTEM_DEFAULT_SLOTS: ReminderSlot[] = ['-2d', '-1d', 'day-of']
export const SYSTEM_DEFAULT_TIME = '12:00'

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** True for a valid 24-hour `HH:MM` string. */
export function isValidReminderTime(s: string): boolean {
  return HH_MM_RE.test(s)
}

/** Filter an arbitrary array down to valid, de-duplicated `ReminderSlot`s. */
export function sanitizeSlots(arr: unknown): ReminderSlot[] {
  const valid = new Set<ReminderSlot>(REMINDER_SLOTS)
  const out: ReminderSlot[] = []
  for (const s of Array.isArray(arr) ? arr : []) {
    if (valid.has(s as ReminderSlot) && !out.includes(s as ReminderSlot)) {
      out.push(s as ReminderSlot)
    }
  }
  return out
}

/** Account-level default preference (stored on `User`). `null` = "not set". */
export interface PrefUserInput {
  notifyExpiry: boolean
  reminderSlots: ReminderSlot[] | null
  reminderTime: string | null
  tz: string | null
}

/**
 * Per-org override (stored on `UserOrgNotificationPref`). `null` row = inherit
 * the account default. Within a row, any `null` field inherits downwards; `[]`
 * slots is an explicit "no reminders".
 */
export interface PrefOrgOverride {
  notifyExpiry: boolean | null
  reminderSlots: ReminderSlot[] | null
  reminderTime: string | null
}

export interface ResolvePrefInput {
  user: PrefUserInput
  orgOverride: PrefOrgOverride | null
  /** Valid IANA zone — passed in so the resolver stays pure. */
  serverTz: string
}

export interface EffectiveReminderPref {
  /** Master on/off resolved (per-org override wins over account master). */
  enabled: boolean
  /** Sanitized slots; `[]` means "no timed reminders". */
  slots: ReminderSlot[]
  /** `HH:MM`. */
  time: string
  /** Valid IANA zone the `time` is interpreted in. */
  tz: string
}

function firstValidTime(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) if (c && isValidReminderTime(c)) return c
  return SYSTEM_DEFAULT_TIME
}

/**
 * Resolve the effective reminder preference for one user in one org.
 *
 * Tiers (highest priority wins; `null` = inherit / fall through):
 *   1. per-org override — `orgOverride`
 *   2. account default — `user`
 *   3. system default — `SYSTEM_DEFAULT_SLOTS` @ `SYSTEM_DEFAULT_TIME`
 *
 * Timezone is its own chain (the override has no tz by design):
 * `user.tz` → `serverTz`.
 */
export function resolveEffectivePref(input: ResolvePrefInput): EffectiveReminderPref {
  const { user, orgOverride, serverTz } = input

  // Master on/off: per-org override (when explicitly set) beats the account master.
  const enabled =
    orgOverride && orgOverride.notifyExpiry !== null ? orgOverride.notifyExpiry : user.notifyExpiry

  // Slots: override → user → system default.
  const slots: ReminderSlot[] =
    orgOverride && orgOverride.reminderSlots !== null
      ? sanitizeSlots(orgOverride.reminderSlots)
      : user.reminderSlots !== null
        ? sanitizeSlots(user.reminderSlots)
        : SYSTEM_DEFAULT_SLOTS.slice()

  // Time-of-day: override → user → system default (each must be valid).
  const time = firstValidTime(orgOverride?.reminderTime, user.reminderTime)

  // Timezone: user → server.
  const tz = user.tz && isValidTz(user.tz) ? user.tz : serverTz

  return { enabled, slots, time, tz }
}
