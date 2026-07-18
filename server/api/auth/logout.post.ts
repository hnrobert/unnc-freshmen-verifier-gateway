import { clearTrustCookie, clearVerifyCookie } from '#server/utils/jwt'

export default defineEventHandler(async (event) => {
  await clearAuthSession(event)
  clearTrustCookie(event)
  clearVerifyCookie(event)
  return { ok: true }
})
