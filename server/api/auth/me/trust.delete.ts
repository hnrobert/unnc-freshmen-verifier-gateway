import { clearVerifyCookie } from '#server/utils/jwt'

/** Revoke THIS browser's visitor trust — clears the vg_verify cookie. */
export default defineEventHandler((event) => {
  clearVerifyCookie(event)
  return { ok: true }
})
