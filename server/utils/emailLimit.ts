/**
 * Per-recipient rate limiting for outbound transactional emails. Each sending
 * flow — welcome content ("welcome"), registration code ("code"), org invite
 * ("invite") — is capped INDEPENDENTLY per target address:
 *   • at most 1 per minute
 *   • at most {@link EMAIL_DAILY_LIMIT} per day
 * When a target's daily count for a flow exceeds 5, the result flags
 * `nearLimit` so the caller can warn the sender that the address is nearly
 * capped.
 *
 * In-memory, single-instance; counters are sliding windows of timestamps.
 */
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000
const PER_MINUTE = 1
/** Max emails per target address per flow per day. */
export const EMAIL_DAILY_LIMIT = 10
/** Warn the sender once the daily count exceeds this. */
const WARN_AFTER = 5

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
  /** Daily send count for this flow+target (current, including this attempt when allowed). */
  dailyCount: number
  /** Seconds until the per-minute cap resets (only when reason === 'minute'). */
  retryInSeconds?: number
  /** True when dailyCount > WARN_AFTER — caller should warn about the daily cap. */
  nearLimit: boolean
}

/**
 * Check (and record) an outbound email to `email` under `flow`. Records the hit
 * only when allowed — a blocked request consumes no quota. `flow` is a stable
 * label: 'welcome' | 'code' | 'invite'.
 */
export function checkEmailSend(
  flow: string,
  email: string,
  now: Date = new Date(),
): EmailLimitResult {
  const key = `${flow}:${email.toLowerCase()}`
  const t = now.getTime()

  const day = windowHits(dayBuckets, key, DAY_MS, t)
  if (day.length >= EMAIL_DAILY_LIMIT) {
    return { allowed: false, reason: 'day', dailyCount: day.length, nearLimit: true }
  }

  const minute = windowHits(minuteBuckets, key, MINUTE_MS, t)
  if (minute.length >= PER_MINUTE) {
    const retry = Math.max(1, Math.ceil((minute[0]! + MINUTE_MS - t) / 1000))
    return {
      allowed: false,
      reason: 'minute',
      dailyCount: day.length,
      retryInSeconds: retry,
      nearLimit: day.length > WARN_AFTER,
    }
  }

  minute.push(t)
  day.push(t)
  return { allowed: true, dailyCount: day.length, nearLimit: day.length > WARN_AFTER }
}

/** Build the HTTP error for a blocked send. Caller throws this as a 429. */
export function emailLimitError(r: EmailLimitResult): {
  statusCode: number
  statusMessage: string
} {
  const statusMessage =
    r.reason === 'minute'
      ? `Please wait ${r.retryInSeconds ?? 60}s before sending another email to this address`
      : `This address has reached its daily limit (${EMAIL_DAILY_LIMIT}/day)`
  return { statusCode: 429, statusMessage }
}

/** Warning string to surface to the sender when `nearLimit` is true. */
export function emailLimitWarning(): string {
  return `Heads up: this address is limited to ${EMAIL_DAILY_LIMIT} emails per day.`
}
