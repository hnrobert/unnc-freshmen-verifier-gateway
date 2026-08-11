import type { AdmissionResult } from '#shared/types'
import { clearVerifyCookie, verifyVerifyJwt } from '#server/utils/jwt'

/**
 * Cross-org "skip verification" check. A visitor who already verified (in any
 * org, on this browser) carries a device-bound `vg_verify` JWT; if it is still
 * valid AND the request's device fingerprint matches the one bound into the
 * token, the caller can jump straight to this org's welcome page without
 * filling the form or re-querying the portal.
 *
 * Returns `{ trusted: false }` (never throws / 4xx) so the verify page degrades
 * gracefully to showing the form. A token that fails the device check is purged
 * so the visitor re-verifies cleanly.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await getOrgBySlug(slug)

  const trust = verifyVerifyJwt(event)

  // Must be a new-format token (idHash + deviceHash claims) and not expired.
  const hasClaims = !!trust?.idHash && !!trust?.deviceHash
  const notExpired = trust ? new Date(trust.trustedUntil) > new Date() : false
  const deviceMatches = trust ? trust.deviceHash === deviceHashFromRequest(event) : false

  if (!org || !trust || !hasClaims || !notExpired) {
    if (trust && !hasClaims) clearVerifyCookie(event) // purge old plaintext-idNumber token
    return { trusted: false } satisfies { trusted: false }
  }

  if (!deviceMatches) {
    // Issued on another browser/device — drop it so they re-verify here.
    clearVerifyCookie(event)
    return { trusted: false } satisfies { trusted: false }
  }

  // Trusted device + identity: record this org's verify (so it shows in stats and
  // dedupes future form submits) and hand back the cached admission so the
  // welcome page renders without a portal call.
  const admission: AdmissionResult = trust.admission ?? {
    ok: true,
    admitted: true,
    message: 'trusted',
    name: trust.name,
  }
  void upsertVerifiedIdentity(org.id, trust.name, trust.idHash)
  void recordVerify(event, org.id, {
    outcome: 'admitted',
    mode: 'trusted',
    name: trust.name,
    idHash: trust.idHash,
  })
  return { trusted: true, admission } satisfies { trusted: true; admission: AdmissionResult }
})
