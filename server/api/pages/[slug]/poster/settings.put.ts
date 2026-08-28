import { AppDataSource } from '#server/utils/database'
import { PagePosterSetting } from '#server/entities/pagePosterSetting.entity'
import { normalizePosterSettings } from '#shared/lib/poster'
import type { PosterSettings } from '#shared/types'

export default defineEventHandler(async (event): Promise<PosterSettings> => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)
  const settings = normalizePosterSettings(await readBody<Partial<PosterSettings>>(event))
  await AppDataSource.getRepository(PagePosterSetting).save({
    pageId: page.id,
    ...settings,
    updatedAt: new Date(),
  })
  return settings
})
