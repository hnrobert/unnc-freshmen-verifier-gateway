import { getVerificationSettings } from '#server/utils/verification'

/** Superadmin: read the site-wide verification switches. */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return await getVerificationSettings()
})
