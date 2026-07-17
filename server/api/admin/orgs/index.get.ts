import { AppDataSource } from '../../../utils/database'
import { Organization } from '../../../entities/organization.entity'
import { User } from '../../../entities/user.entity'

export default defineEventHandler((event) => {
  requireSuperAdmin(event)
  const orgRepo = AppDataSource.getRepository(Organization)
  const userRepo = AppDataSource.getRepository(User)
  return orgRepo.find({ order: { id: 'DESC' } }).then(async (orgs) => {
    const users = await userRepo.find()
    const userMap = new Map(users.map(u => [u.id, u.email]))
    return orgs.map(o => ({
      id: o.id, slug: o.slug, name: o.name,
      createdAt: o.createdAt,
      ownerEmail: userMap.get(o.ownerId) ?? 'unknown',
    }))
  })
})
