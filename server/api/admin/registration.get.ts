import { getEmailWhitelist } from '../../utils/registration'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return await getEmailWhitelist()
})
