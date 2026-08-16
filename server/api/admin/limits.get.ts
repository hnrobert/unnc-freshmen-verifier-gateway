import { getDefaultAdminPageLimit } from '#server/utils/limits'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return { defaultAdminPageLimit: await getDefaultAdminPageLimit() }
})
