import { eq } from 'drizzle-orm'
import { orgImages } from '../../../db/schema'

const MAX_BASE64 = 1_500_000 // ~1MB image as base64
const KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/

// Owner: upsert a base64 image for this org under `key` (e.g. "welcome", "brand").
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = requireOrgOwnership(event, slug)

  const body = await readBody<{ key?: unknown; mime?: unknown; base64?: unknown }>(event)
  const key = String(body?.key ?? '').trim()
  const mime = String(body?.mime ?? '').trim()
  const base64 = String(body?.base64 ?? '').trim().replace(/^data:[^;]+;base64,/, '')

  if (!KEY_RE.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
  if (!mime.startsWith('image/')) throw createError({ statusCode: 400, statusMessage: 'mime must be image/*' })
  if (!base64 || base64.length > MAX_BASE64) {
    throw createError({ statusCode: 413, statusMessage: 'Image too large (max ~1MB)' })
  }

  const id = `${org.id}:${key}`
  useDB()
    .insert(orgImages)
    .values({ id, orgId: org.id, key, mime, base64 })
    .onConflictDoUpdate({ target: orgImages.id, set: { mime, base64 } })
    .run()

  return { ok: true, key, ref: `img:${key}` }
})
