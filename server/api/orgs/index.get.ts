import { AppDataSource } from '../../utils/database'
import { Organization } from '../../entities/organization.entity'

export default defineEventHandler((event) => {
  const user = requireAuth(event)
  return AppDataSource.getRepository(Organization
).find({ where: { ownerId: user.id } }).then((orgs) => ({
    orgs: orgs.map((o) => ({ id: o.id, slug: o.slug, name: o.name, createdAt: o.createdAt })),
  }))
})
