import { getDefaultAdminOrgLimit } from '#server/utils/limits'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return { defaultAdminOrgLimit: await getDefaultAdminOrgLimit() }
})
