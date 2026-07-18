import { AppDataSource } from '#server/utils/database'
import { OrgSetting } from '#server/entities/orgSetting.entity'
import type { SiteConfig } from '#shared/types'
import { validateConfig } from '#shared/lib/validateConfig'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.editor)
  const body = await readBody<{ config?: unknown }>(event)
  let errors: string[]
  try {
    errors = validateConfig(body.config as SiteConfig)
  } catch {
    errors = ['invalid config shape']
  }
  if (errors.length)
    throw createError({ statusCode: 400, statusMessage: 'Config invalid', data: { errors } })
  await AppDataSource.getRepository(OrgSetting).update(
    { orgId: org.id },
    { config: JSON.stringify(body.config), updatedAt: new Date() },
  )
  invalidateOrgConfig(slug)
  return { ok: true }
})
