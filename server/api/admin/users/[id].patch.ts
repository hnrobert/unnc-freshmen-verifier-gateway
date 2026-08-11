import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'

export default defineEventHandler(async (event) => {
  const me = requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ role?: unknown; orgLimit?: unknown }>(event)

  const repo = AppDataSource.getRepository(User)
  const user = await repo.findOneBy({ id })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  const oldRole = user.role
  const oldOrgLimit = user.orgLimit

  if (body.role !== undefined) {
    const role = String(body.role)
    if (!['admin', 'superadmin'].includes(role))
      throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
    user.role = role
  }

  // Per-user org-creation cap. `null` resets to the default; otherwise a
  // non-negative integer (0 blocks org creation entirely). Superadmins ignore
  // this (always unlimited), but it can still be stored for when they demote.
  if (body.orgLimit !== undefined) {
    if (body.orgLimit === null) {
      user.orgLimit = null
    } else {
      const n = Number(body.orgLimit)
      if (!Number.isInteger(n) || n < 0)
        throw createError({ statusCode: 400, statusMessage: 'Invalid org limit' })
      user.orgLimit = n
    }
  }

  await repo.save(user)
  void recordAudit(event, {
    action: 'admin.user_update',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    detail: {
      targetUserId: user.id,
      targetEmail: user.email,
      role: oldRole !== user.role ? { from: oldRole, to: user.role } : undefined,
      orgLimit:
        oldOrgLimit !== user.orgLimit ? { from: oldOrgLimit, to: user.orgLimit } : undefined,
    },
  })
  return { id: user.id, email: user.email, role: user.role, orgLimit: user.orgLimit }
})
