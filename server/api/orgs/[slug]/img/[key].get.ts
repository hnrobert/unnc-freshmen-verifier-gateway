import { and, eq } from 'drizzle-orm'
import { orgImages, organizations } from '../../../../db/schema'

// Public: serve an org's stored image (base64 → bytes) with immutable caching.
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string

  const org = useDB().select().from(organizations).where(eq(organizations.slug, slug)).all()[0]
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const img = useDB()
    .select()
    .from(orgImages)
    .where(and(eq(orgImages.orgId, org.id), eq(orgImages.key, key)))
    .all()[0]
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setHeader(event, 'Content-Type', img.mime)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'ETag', `"${img.id}"`)
  return Buffer.from(img.base64, 'base64')
})
