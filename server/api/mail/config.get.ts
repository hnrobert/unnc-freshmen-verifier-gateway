import { getMailConfig, mailConfigToClient } from '#server/utils/mail'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  return mailConfigToClient(await getMailConfig())
})
