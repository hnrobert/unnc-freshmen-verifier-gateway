import { AppDataSource } from '../../../utils/database'
import { OrgImage } from '../../../entities/orgImage.entity'

const MAX_BASE64 = 1_500_000
const KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await requireOrgOwnership(event, slug)
  const body = await readBody<{ key?: unknown; mime?: unknown; base64?: unknown }>(event)
  const key = String(body?.key ?? '').trim()
  const mime = String(body?.mime ?? '').trim()
  const base64 = String(body?.base64 ?? '').trim().replace(/^data:[^;]+;base64,/, '')

  if (!KEY_RE.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
  if (!mime.startsWith('image/')) throw createError({ statusCode: 400, statusMessage: 'mime must be image/*' })
  if (!base64 || base64.length > MAX_BASE64) throw createError({ statusCode: 413, statusMessage: 'Image too large (max ~1MB)' })

  const repo = AppDataSource.getRepository(OrgImage)
  const existing = await repo.findOne({ where: { orgId: org.id, key } })
  if (existing) {
    existing.mime = mime
    existing.base64 = base64
    await repo.save(existing)
  } else {
    await repo.insert({ orgId: org.id, key, mime, base64 })
  }
  invalidateImageCache(org.id)
  return { ok: true, key, ref: `img:${key}` }
})
