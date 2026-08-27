import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { PageImage } from '#server/entities/pageImage.entity'

// Returns raw base64 + mime as JSON. The frontend constructs the data URL.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string

  const page = await AppDataSource.getRepository(Page).findOne({ where: { slug } })
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const img = await AppDataSource.getRepository(PageImage).findOne({
    where: { pageId: page.id, key },
  })
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return { mime: img.mime, base64: img.base64 }
})
