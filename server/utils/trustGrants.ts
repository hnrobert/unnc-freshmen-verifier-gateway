import { AppDataSource } from './database'
import { TrustGrant } from '#server/entities/trustGrant.entity'

/**
 * Server-side bookkeeping for browser-trust grants (the vg_verify cookie's
 * registry — see the TrustGrant entity). Three operations:
 *
 *  • {@link recordTrustGrant} — upsert the row whenever a verify issues or
 *    the sliding renewal re-issues a trust cookie (a re-verify on a revoked
 *    device clears the revocation — fresh verification re-earns trust).
 *  • {@link isDeviceTrustRevoked} — consulted by the public /trust check and
 *    the check bypass: a revoked device's cookie is inert everywhere.
 *  • listing/revoking from Settings (see /api/auth/me/trust*).
 *
 * All writes are best-effort: the registry enriches management, but a failed
 * write must never block the verify response.
 */

async function repo() {
  return AppDataSource.getRepository(TrustGrant)
}

/** Upsert the grant for this device (called at trust-issue / renewal points). */
export async function recordTrustGrant(input: {
  deviceHash: string
  name: string
  userId: number | null
  userAgent: string | null
  trustedUntil: Date
}): Promise<void> {
  try {
    const r = await repo()
    const existing = await r.findOne({ where: { deviceHash: input.deviceHash } })
    if (existing) {
      existing.name = input.name
      existing.userAgent = input.userAgent ?? existing.userAgent
      existing.trustedUntil = input.trustedUntil
      existing.lastRefreshedAt = new Date()
      // Re-verification on a revoked device re-earns trust.
      existing.revokedAt = null
      // Adopt the latest signed-in account (the browser is now theirs).
      if (input.userId != null) existing.userId = input.userId
      await r.save(existing)
    } else {
      await r.insert({
        deviceHash: input.deviceHash,
        userId: input.userId,
        name: input.name,
        userAgent: input.userAgent,
        trustedUntil: input.trustedUntil,
        lastRefreshedAt: new Date(),
        revokedAt: null,
      })
    }
  } catch {
    /* best-effort */
  }
}

/** True when this device's grant has been revoked from Settings. */
export async function isDeviceTrustRevoked(deviceHash: string): Promise<boolean> {
  try {
    const grant = await (await repo()).findOne({ where: { deviceHash } })
    return !!grant?.revokedAt
  } catch {
    return false
  }
}

/** All trust grants belonging to a user (their devices, newest first). */
export async function listUserTrustGrants(userId: number): Promise<TrustGrant[]> {
  return (await repo()).find({ where: { userId }, order: { lastRefreshedAt: 'DESC' } })
}

/** Revoke one grant by id, owned by the given user. Returns false if not found. */
export async function revokeTrustGrant(userId: number, grantId: number): Promise<boolean> {
  const r = await repo()
  const grant = await r.findOne({ where: { id: grantId, userId } })
  if (!grant) return false
  grant.revokedAt = new Date()
  await r.save(grant)
  return true
}

/** Revoke by device hash (the current browser). Returns true when a row existed. */
export async function revokeTrustGrantByDevice(deviceHash: string): Promise<boolean> {
  const r = await repo()
  const grant = await r.findOne({ where: { deviceHash } })
  if (!grant) return false
  grant.revokedAt = new Date()
  await r.save(grant)
  return true
}
