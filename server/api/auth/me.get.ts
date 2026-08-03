import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const full = await AppDataSource.getRepository(User).findOneBy({ id: user.id })
  return { user, notifyExpiry: !!full?.notifyExpiry }
})
