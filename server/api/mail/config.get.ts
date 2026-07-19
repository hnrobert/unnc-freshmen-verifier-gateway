import { getMailConfig, mailConfigToClient } from '#server/utils/mail'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  return mailConfigToClient(await getMailConfig(user.id))
})
