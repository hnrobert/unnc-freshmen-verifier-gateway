import { eq } from 'drizzle-orm'
import { organizations } from '../../db/schema'

export default defineEventHandler((event) => {
  const user = requireAuth(event)
  const orgs = useDB()
    .select()
    .from(organizations)
    .where(eq(organizations.ownerId, user.id))
    .all()
  return {
    orgs: orgs.map((o) => ({ id: o.id, slug: o.slug, name: o.name, createdAt: o.createdAt })),
  }
})
