import { AppDataSource } from '../../utils/database'
import { User } from '../../entities/user.entity'

export default defineEventHandler((event) => {
  requireSuperAdmin(event)
  return AppDataSource.getRepository(User).find({
    order: { id: 'ASC' },
  })
})
