import { listUserTrustGrants } from '#server/utils/trustGrants'

/**
 * The caller's trusted browsers — every trust grant earned while THIS account
 * was signed in (freshman/email verifies on those devices). Each entry carries
 * the verified name, a device label parsed from the User-Agent snapshot,
 * expiry, last-visit time, revoked state, and whether it is the calling
 * browser (device-hash match).
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const grants = await listUserTrustGrants(me.id)
  const currentHash = deviceHashFromRequest(event)
  return {
    devices: grants.map((g) => ({
      id: g.id,
      name: g.name,
      device: deviceLabel(g.userAgent),
      current: g.deviceHash === currentHash,
      trustedUntil: g.trustedUntil.toISOString(),
      lastRefreshedAt: g.lastRefreshedAt.toISOString(),
      revoked: !!g.revokedAt,
    })),
  }
})

/** Compact "Chrome · macOS" style label from a UA snapshot. */
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return [browser, os].filter(Boolean).join(' · ') || 'Unknown device'
}
