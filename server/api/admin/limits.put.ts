import { setDefaultAdminPageLimit } from '#server/utils/limits'

export default defineEventHandler(async (event) => {
  const me = requireSuperAdmin(event)
  const body = await readBody<{ defaultAdminPageLimit?: unknown }>(event)
  const n = Number(body?.defaultAdminPageLimit)
  if (!Number.isInteger(n) || n < 0)
    throw createError({ statusCode: 400, statusMessage: 'Invalid default page limit' })

  await setDefaultAdminPageLimit(n)
  void recordAudit(event, {
    action: 'admin.default_limit',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    detail: { defaultAdminPageLimit: n },
  })
  return { defaultAdminPageLimit: n }
})
