/**
 * Rate limiting for outbound transactional emails — two independent dimensions:
 *
 *  • Per-target (recipient address), per flow: 1/minute, {@link EMAIL_DAILY_LIMIT}/day.
 *    Applied to every user-initiated send (welcome content, registration code,
 *    org invite, mail test) so one address can't be spammed. {@link checkEmailSend}
 *  • Per-account (the authenticated sender), aggregated across all flows they
 *    initiate: {@link ACCOUNT_PER_MINUTE}/min, {@link ACCOUNT_DAILY_LIMIT}/day.
 *    Applies only to sends by a logged-in user (org invite, mail test);
 *    unauthenticated flows (welcome/code) have no account and rely on the
 *    per-target cap. {@link checkAccountSend}
 *
 * Each result carries a `warning` string once the daily count approaches the cap
 * (per-target: >5, per-account: ≥20) so the caller can toast the sender.
 * In-memory, single-instance; counters are sliding windows of timestamps.
 */
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

/** Per-target caps. */
export const EMAIL_DAILY_LIMIT = 10
const TARGET_PER_MINUTE = 1
const TARGET_WARN_AFTER = 5 // warn once the daily count exceeds this

/** Per-account caps. */
export const ACCOUNT_PER_MINUTE = 6
export const ACCOUNT_DAILY_LIMIT = 24
const ACCOUNT_WARN_AT = 20 // warn once the daily count reaches this

const minuteBuckets = new Map<string, number[]>()
const dayBuckets = new Map<string, number[]>()

/** Prune a bucket to timestamps still inside `windowMs` (and keep the map tight). */
function windowHits(
  bucket: Map<string, number[]>,
  key: string,
  windowMs: number,
  now: number,
): number[] {
  const arr = (bucket.get(key) ?? []).filter((t) => now - t < windowMs)
  bucket.set(key, arr)
  return arr
}

export interface EmailLimitResult {
  allowed: boolean
  /** Which cap was hit, when not allowed. */
  reason?: 'minute' | 'day'
  /** Daily send count for this key (including this attempt when allowed). */
  dailyCount: number
  /** The daily cap this result was checked against (for error/warning wording). */
  dailyLimit: number
  /** Who the cap applies to — wording only. */
  scope: 'address' | 'account'
  /** Seconds until the per-minute cap resets (only when reason === 'minute'). */
  retryInSeconds?: number
  /** Warning string when approaching the daily cap; undefined otherwise. */
  warning?: string
}

/** Sliding-window check that records the hit only when allowed. */
function slidingCheck(
  key: string,
  perMinute: number,
  perDay: number,
  now: number,
): { allowed: boolean; reason?: 'minute' | 'day'; dailyCount: number; retryInSeconds?: number } {
  const day = windowHits(dayBuckets, key, DAY_MS, now)
  if (day.length >= perDay) return { allowed: false, reason: 'day', dailyCount: day.length }
  const minute = windowHits(minuteBuckets, key, MINUTE_MS, now)
  if (minute.length >= perMinute) {
    const retry = Math.max(1, Math.ceil((minute[0]! + MINUTE_MS - now) / 1000))
    return { allowed: false, reason: 'minute', dailyCount: day.length, retryInSeconds: retry }
  }
  minute.push(now)
  day.push(now)
  return { allowed: true, dailyCount: day.length }
}

function withWording(
  r: ReturnType<typeof slidingCheck>,
  scope: 'address' | 'account',
  dailyLimit: number,
  warnWhen: (n: number) => boolean,
): EmailLimitResult {
  return {
    ...r,
    dailyLimit,
    scope,
    warning: warnWhen(r.dailyCount)
      ? `Heads up: this ${scope} is limited to ${dailyLimit} emails per day.`
      : undefined,
  }
}

/** Per-recipient cap for `flow` ('welcome' | 'code' | 'invite' | 'test'). 1/min, 10/day. */
export function checkEmailSend(
  flow: string,
  email: string,
  now: Date = new Date(),
): EmailLimitResult {
  const r = slidingCheck(
    `target:${flow}:${email.toLowerCase()}`,
    TARGET_PER_MINUTE,
    EMAIL_DAILY_LIMIT,
    now.getTime(),
  )
  return withWording(r, 'address', EMAIL_DAILY_LIMIT, (n) => n > TARGET_WARN_AFTER)
}

/** Per-account cap (aggregated across flows). 6/min, 24/day; warn at ≥20/day. */
export function checkAccountSend(
  userId: number | string,
  now: Date = new Date(),
): EmailLimitResult {
  const r = slidingCheck(
    `account:${userId}`,
    ACCOUNT_PER_MINUTE,
    ACCOUNT_DAILY_LIMIT,
    now.getTime(),
  )
  return withWording(r, 'account', ACCOUNT_DAILY_LIMIT, (n) => n >= ACCOUNT_WARN_AT)
}

/** Build the HTTP error for a blocked send (reads its own limit/scope). */
export function emailLimitError(r: EmailLimitResult): {
  statusCode: number
  statusMessage: string
} {
  const statusMessage =
    r.reason === 'minute'
      ? `Please wait ${r.retryInSeconds ?? 60}s before sending another email`
      : `Daily sending limit reached (${r.dailyLimit}/day for this ${r.scope})`
  return { statusCode: 429, statusMessage }
}
