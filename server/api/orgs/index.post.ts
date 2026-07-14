import { eq } from 'drizzle-orm'
import { organizations, orgSettings } from '../../db/schema'
import defaultConfig from '../../../shared/lib/defaultConfig'
import type { SiteConfig } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{ slug?: unknown; name?: unknown }>(event)
  const slug = String(body?.slug ?? '').trim().toLowerCase()
  const name = String(body?.name ?? '').trim()

  const slugError = validateSlug(slug)
  if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })

  const existing = useDB().select().from(organizations).where(eq(organizations.slug, slug)).all()
  if (existing.length) throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })

  const id = crypto.randomUUID()
  useDB().insert(organizations).values({ id, ownerId: user.id, slug, name }).run()

  // Seed config = defaultConfig with the brand title set to the org name.
  const cfg = structuredClone(defaultConfig) as SiteConfig
  ;(cfg.messages.zh as { brand: { title: string } }).brand.title = name
  ;(cfg.messages.en as { brand: { title: string } }).brand.title = name
  useDB().insert(orgSettings).values({ orgId: id, config: JSON.stringify(cfg) }).run()

  return { org: { id, slug, name } }
})
