/**
 * Tiny in-memory sliding-window rate limiter. Single-instance only (the app runs
 * one Nitro server); for multi-instance you'd need a shared store. Used to throttle
 * registration verification-code requests (per email) and org invites (per user).
 *
 * Each key keeps a list of request timestamps within `windowMs`; a request is
 * allowed only if fewer than `max` have occurred in the window, and the act of
 * checking records the current timestamp. Expired timestamps are pruned on every
 * call so idle keys don't accumulate.
 */
const buckets = new Map<string, number[]>()

/**
 * Record a hit against `key` if the limit hasn't been reached.
 * Returns `true` if allowed (and the hit is recorded), `false` if over the limit.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  return true
}
