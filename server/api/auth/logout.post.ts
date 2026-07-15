import { clearTrustCookie } from '../../utils/jwt'

export default defineEventHandler(async (event) => {
  await clearAuthSession(event)
  clearTrustCookie(event)
  return { ok: true }
})
