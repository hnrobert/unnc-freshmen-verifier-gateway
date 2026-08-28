import { AppDataSource } from '#server/utils/database'
import { PageShareSetting } from '#server/entities/pageShareSetting.entity'
import { normalizeShareSettings } from '#shared/lib/poster'
import type { ShareSettings } from '#shared/types'

export default defineEventHandler(async (event): Promise<ShareSettings> => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)
  // Numerics are clamped into range (see normalizeShareSettings) rather than
  // rejected — the form constrains them anyway; only the title has a hard cap.
  const settings = normalizeShareSettings((await readBody<Partial<ShareSettings>>(event)) ?? {})
  if (settings.title.length > 200)
    throw createError({ statusCode: 400, statusMessage: 'Title must be 200 characters or fewer' })
  await AppDataSource.getRepository(PageShareSetting).upsert(
    { pageId: page.id, ...settings, updatedAt: new Date() },
    ['pageId'],
  )
  return settings
})
