import { setVerifyCookie, signVerifyJwt } from './jwt'
import { recordTrustGrant } from './trustGrants'

/**
 * Issue a visitor-trust cookie AND register the grant server-side (the
 * Settings → Trusted browsers registry). One call for every trust-issue point
 * (freshman live/mock/reused, email-code). `trustBrowser=false` (the form's
 * opt-out) skips both. Best-effort on the registry write.
 */
export async function issueTrust(
  event: Parameters<typeof setVerifyCookie>[0],
  opts: {
    name: string
    idHash: string
    deviceHash: string
    admission?: AdmissionResultLike
    ttlMs: number
    trustBrowser: boolean
    /** Signed-in user when the trust was earned (Settings lists their devices). */
    userId: number | null
  },
): Promise<void> {
  if (!opts.trustBrowser) return
  const token = signVerifyJwt(opts.name, opts.idHash, opts.deviceHash, opts.admission, opts.ttlMs)
  setVerifyCookie(event, token, opts.ttlMs)
  const until = new Date(Date.now() + opts.ttlMs)
  void recordTrustGrant({
    deviceHash: opts.deviceHash,
    name: opts.name,
    userId: opts.userId,
    userAgent: getRequestHeader(event, 'user-agent') ?? null,
    trustedUntil: until,
  })
}

// Structural stand-in for AdmissionResult (avoids importing #shared here).
interface AdmissionResultLike {
  ok: boolean
  admitted: boolean | null
  message: string
  name?: string
  detail?: string
  university?: string
  date?: string
}
