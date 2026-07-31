import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'

/** List every account (superadmin only). */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const users = await AppDataSource.getRepository(User).find({ order: { id: 'ASC' } })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }))
})
