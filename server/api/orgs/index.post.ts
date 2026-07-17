import { AppDataSource } from '../../utils/database'
import { Organization } from '../../entities/organization.entity'
import { OrgSetting } from '../../entities/orgSetting.entity'
import defaultConfig from '../../../shared/lib/defaultConfig'
import type { SiteConfig } from '../../../shared/types'
import type { Locale } from '../../../shared/types'

/** Recursively set all string leaves to empty string (keep object structure). */
function blankMessages(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string') {
      obj[key] = ''
    } else if (val && typeof val === 'object') {
      blankMessages(val as Record<string, unknown>)
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{ slug?: unknown; name?: unknown }>(event)
  const slug = String(body?.slug ?? '').trim().toLowerCase()
  const name = String(body?.name ?? '')

  const slugError = validateSlug(slug)
  if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })

  const orgRepo = AppDataSource.getRepository(Organization)
  const existing = await orgRepo.findOne({ where: { slug } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })

  const org = await orgRepo.save({ ownerId: user.id, slug, name })

  // Clone structure from defaultConfig but blank all message strings —
  // the org inherits defaults via applyDefaults + LocaleField placeholders,
  // and only stores custom values the admin actually changes.
  const cfg = structuredClone(defaultConfig) as SiteConfig
  for (const loc of cfg.locales as Locale[]) {
    blankMessages(cfg.messages[loc] as Record<string, unknown>)
  }
  await AppDataSource.getRepository(OrgSetting).save({ orgId: org.id, config: JSON.stringify(cfg) })

  return { org: { id: org.id, slug: org.slug, name: org.name } }
})
