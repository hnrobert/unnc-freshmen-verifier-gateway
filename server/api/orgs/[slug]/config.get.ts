import { eq } from 'drizzle-orm'
import { orgSettings } from '../../../db/schema'

// Public: returns the resolved SiteConfig (img: refs → URLs) for gateway rendering.
// `?edit=1` (owner only): returns the raw stored config (img: refs intact) for the editor.
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug') as string

  if (getQuery(event).edit !== undefined) {
    const org = requireOrgOwnership(event, slug)
    const settings = useDB()
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, org.id))
      .all()[0]
    if (!settings) throw createError({ statusCode: 404, statusMessage: 'Config not found' })
    return JSON.parse(settings.config)
  }

  return loadOrgConfig(slug)
})
