import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { Page } from '#server/entities/page.entity'

/** List every account (superadmin only), with each owner's page count. */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const [users, counts] = await Promise.all([
    AppDataSource.getRepository(User).find({ order: { id: 'ASC' } }),
    AppDataSource.getRepository(Page)
      .createQueryBuilder('o')
      .select('o.ownerId', 'ownerId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.ownerId')
      .getRawMany<{ ownerId: number; count: string }>(),
  ])
  const ownedMap = new Map(counts.map((c) => [c.ownerId, Number(c.count)]))
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    pageLimit: u.pageLimit,
    pageCount: ownedMap.get(u.id) ?? 0,
    createdAt: u.createdAt,
  }))
})
