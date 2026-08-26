import { verifyVerifyJwt } from '#server/utils/jwt'

/**
 * The CURRENT browser's visitor-trust state (vg_verify): who it's bound to,
 * when it lapses, and how long a revisit still slides the window. The trust
 * is anonymous/device-bound — there is no account-level list of browsers, so
 * this reads the caller's own cookie only.
 */
export default defineEventHandler((event) => {
  const payload = verifyVerifyJwt(event)
  if (!payload) return { trusted: false as const }

  const until = new Date(payload.trustedUntil)
  // Original TTL from the token (trustedUntil − issued-at) drives the slide.
  const ttlMs = payload.iat ? until.getTime() - payload.iat * 1000 : 0
  return {
    trusted: true as const,
    name: payload.name,
    trustedUntil: until.toISOString(),
    // A revisit within this window renews the trust to a full window again.
    slideWindowDays: ttlMs > 0 ? Math.round(ttlMs / 86_400_000) : null,
  }
})
