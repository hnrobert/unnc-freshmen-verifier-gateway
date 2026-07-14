import { eq } from 'drizzle-orm'
import { organizations } from '../../../db/schema'

// Owner: delete the org (cascades to org_settings + org_images).
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = requireOrgOwnership(event, slug)
  useDB().delete(organizations).where(eq(organizations.id, org.id)).run()
  invalidateOrgConfig(slug)
  return { ok: true }
})
