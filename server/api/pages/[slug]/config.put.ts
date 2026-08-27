import { AppDataSource } from '#server/utils/database'
import { PageSetting } from '#server/entities/pageSetting.entity'
import type { SiteConfig } from '#shared/types'
import { validateConfig } from '#shared/lib/validateConfig'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)
  const body = await readBody<{ config?: unknown }>(event)
  let errors: string[]
  try {
    errors = validateConfig(body.config as SiteConfig)
  } catch {
    errors = ['invalid config shape']
  }
  if (errors.length)
    throw createError({ statusCode: 400, statusMessage: 'Config invalid', data: { errors } })
  await AppDataSource.getRepository(PageSetting).update(
    { pageId: page.id },
    { config: JSON.stringify(body.config), updatedAt: new Date() },
  )
  invalidatePageConfig(slug)
  return { ok: true }
})
