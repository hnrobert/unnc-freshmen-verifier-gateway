import { AppDataSource } from '#server/utils/database'
import { PageSetting } from '#server/entities/pageSetting.entity'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  if (getQuery(event).edit !== undefined) {
    const { page } = await requirePageRole(event, slug, RANK.viewer)
    const settings = await AppDataSource.getRepository(PageSetting).findOne({
      where: { pageId: page.id },
    })
    if (!settings) throw createError({ statusCode: 404, statusMessage: 'Config not found' })
    return JSON.parse(settings.config)
  }
  return await loadPageConfig(slug)
})
