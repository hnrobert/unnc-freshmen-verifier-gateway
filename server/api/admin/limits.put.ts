import { setDefaultAdminOrgLimit } from '#server/utils/limits'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ defaultAdminOrgLimit?: unknown }>(event)
  const n = Number(body?.defaultAdminOrgLimit)
  if (!Number.isInteger(n) || n < 0)
    throw createError({ statusCode: 400, statusMessage: 'Invalid default org limit' })

  await setDefaultAdminOrgLimit(n)
  return { defaultAdminOrgLimit: n }
})
