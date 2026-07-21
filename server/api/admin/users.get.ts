import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'

export default defineEventHandler((event) => {
  requireSuperAdmin(event)
  return AppDataSource.getRepository(User).find({
    order: { id: 'ASC' },
  })
})
