import { getEmailWhitelist } from '#server/utils/registration'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return await getEmailWhitelist()
})
