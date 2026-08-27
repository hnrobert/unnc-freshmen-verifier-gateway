import { clearVerifyCookie } from '#server/utils/jwt'
import { revokeTrustGrant } from '#server/utils/trustGrants'

/**
 * Revoke one of the caller's trusted browsers (Settings → Trusted browsers).
 * Marks the grant revoked — that device's vg_verify cookie becomes inert on
 * its next request (the public /trust check and sliding renewal purge it).
 * When revoking the CURRENT browser the cookie is also cleared immediately.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const ok = await revokeTrustGrant(me.id, id)
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Trusted browser not found' })

  clearVerifyCookie(event)
  return { ok: true }
})
