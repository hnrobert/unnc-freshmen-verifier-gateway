import { AppDataSource } from '../../../utils/database'
import { User } from '../../../entities/user.entity'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ role?: unknown }>(event)
  const role = String(body?.role ?? '')

  if (!['admin', 'superadmin'].includes(role))
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })

  const repo = AppDataSource.getRepository(User)
  const user = await repo.findOneBy({ id })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  user.role = role
  await repo.save(user)
  return { id: user.id, email: user.email, role: user.role }
})
