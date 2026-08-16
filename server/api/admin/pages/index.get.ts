import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { User } from '#server/entities/user.entity'

export default defineEventHandler((event) => {
  requireSuperAdmin(event)
  const pageRepo = AppDataSource.getRepository(Page)
  const userRepo = AppDataSource.getRepository(User)
  return pageRepo.find({ order: { id: 'DESC' } }).then(async (pages) => {
    const users = await userRepo.find()
    const userMap = new Map(users.map((u) => [u.id, u.email]))
    return pages.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      createdAt: o.createdAt,
      ownerId: o.ownerId,
      ownerEmail: userMap.get(o.ownerId) ?? 'unknown',
    }))
  })
})
