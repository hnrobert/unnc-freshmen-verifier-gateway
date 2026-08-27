import { AppDataSource } from '#server/utils/database'
import { PageImage } from '#server/entities/pageImage.entity'

// Base64 is ~4/3 the binary size, so allow a 100MB image with headroom.
const MAX_BASE64 = 150_000_000
const KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)
  const body = await readBody<{ key?: unknown; mime?: unknown; base64?: unknown }>(event)
  const key = String(body?.key ?? '').trim()
  const mime = String(body?.mime ?? '').trim()
  const base64 = String(body?.base64 ?? '')
    .trim()
    .replace(/^data:[^;]+;base64,/, '')

  if (!KEY_RE.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
  if (!mime.startsWith('image/'))
    throw createError({ statusCode: 400, statusMessage: 'mime must be image/*' })
  if (!base64 || base64.length > MAX_BASE64)
    throw createError({ statusCode: 413, statusMessage: 'Image too large (max ~100MB)' })

  const repo = AppDataSource.getRepository(PageImage)
  const existing = await repo.findOne({ where: { pageId: page.id, key } })
  if (existing) {
    existing.mime = mime
    existing.base64 = base64
    await repo.save(existing)
  } else {
    await repo.insert({ pageId: page.id, key, mime, base64 })
  }
  invalidateImageCache(page.id)

  // For the welcome QR image, try to OCR an expiry date so the editor can show
  // it immediately (best-effort — never fails the upload). Other keys skip OCR.
  let expiresAt: string | null = null
  if (key === 'welcome') {
    try {
      const date = await detectWelcomeExpiry(Buffer.from(base64, 'base64'))
      if (date) expiresAt = toLocalDateStr(date)
    } catch {
      // OCR unavailable/unreadable — leave expiresAt null
    }
  }

  return { ok: true, key, ref: `img:${key}`, expiresAt }
})
