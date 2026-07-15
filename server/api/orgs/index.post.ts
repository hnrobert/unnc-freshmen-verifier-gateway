import { AppDataSource } from '../../utils/database'
import { Organization } from '../../entities/organization.entity'
import { OrgSetting } from '../../entities/orgSetting.entity'
import defaultConfig from '../../../shared/lib/defaultConfig'
import type { SiteConfig } from '../../../shared/types'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{ slug?: unknown; name?: unknown }>(event)
  const slug = String(body?.slug ?? '').trim().toLowerCase()
  const name = String(body?.name ?? '').trim()

  const slugError = validateSlug(slug)
  if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })

  const orgRepo = AppDataSource.getRepository(Organization)
  const existing = await orgRepo.findOne({ where: { slug } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })

  const org = await orgRepo.save({ ownerId: user.id, slug, name })

  const cfg = structuredClone(defaultConfig) as SiteConfig
  ;(cfg.messages.zh as { brand: { title: string } }).brand.title = name
  ;(cfg.messages.en as { brand: { title: string } }).brand.title = name
  await AppDataSource.getRepository(OrgSetting).save({ orgId: org.id, config: JSON.stringify(cfg) })

  return { org: { id: org.id, slug: org.slug, name: org.name } }
})
