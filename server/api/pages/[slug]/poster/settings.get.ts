import { AppDataSource } from '#server/utils/database'
import { PagePosterSetting } from '#server/entities/pagePosterSetting.entity'
import { DEFAULT_POSTER_SETTINGS, normalizePosterSettings } from '#shared/lib/poster'
import type { PosterSettings } from '#shared/types'
import { loadPageConfig } from '#server/utils/pages'

export default defineEventHandler(async (event): Promise<PosterSettings> => {
  const slug = getRouterParam(event, 'slug') as string
  const page = await getPageBySlug(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  const row = await AppDataSource.getRepository(PagePosterSetting).findOne({
    where: { pageId: page.id },
  })
  const config = row ? null : await loadPageConfig(slug)
  return normalizePosterSettings(
    row
      ? {
          title: row.title,
          theme: row.theme as PosterSettings['theme'],
          fontSize: row.fontSize,
          width: row.width,
          height: row.height,
          border: row.border,
          borderRadius: row.borderRadius,
        }
      : { ...DEFAULT_POSTER_SETTINGS, title: config?.share?.posterTitle ?? '' },
  )
})
