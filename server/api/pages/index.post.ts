import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { PageSetting } from '#server/entities/pageSetting.entity'
import { User } from '#server/entities/user.entity'
import { PageRedirect } from '#server/entities/pageRedirect.entity'
import { getDefaultAdminPageLimit } from '#server/utils/limits'
import defaultConfig from '#shared/lib/defaultConfig'
import type { SiteConfig } from '#shared/types'
import type { Locale } from '#shared/types'

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
  const slug = String(body?.slug ?? '')
    .trim()
    .toLowerCase()
  const name = String(body?.name ?? '')

  const slugError = validateSlug(slug)
  if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })

  const pageRepo = AppDataSource.getRepository(Page)

  // Page-creation cap. Superadmins are unlimited; regular admins are bounded by
  // their per-user limit, else the app-wide default (superadmin-tunable).
  if (user.role !== 'superadmin') {
    const owner = await AppDataSource.getRepository(User).findOneBy({ id: user.id })
    const limit = owner?.pageLimit ?? (await getDefaultAdminPageLimit())
    const owned = await pageRepo.count({ where: { ownerId: user.id } })
    if (owned >= limit) {
      throw createError({
        statusCode: 403,
        statusMessage: `Page limit reached (${owned}/${limit}). Ask a superadmin to raise it.`,
      })
    }
  }

  const existing = await pageRepo.findOne({ where: { slug } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })

  const page = await pageRepo.save({ ownerId: user.id, slug, name })

  // Claiming this slug ends any redirect left by a previously-deleted page that
  // once held it — a new page using the slug must be reachable at its own URL.
  await AppDataSource.getRepository(PageRedirect).delete({ oldSlug: slug })

  // Clone structure from defaultConfig but blank all message strings —
  // the page inherits defaults via applyDefaults + LocaleField placeholders,
  // and only stores custom values the admin actually changes.
  const cfg = structuredClone(defaultConfig) as SiteConfig
  for (const loc of cfg.locales as Locale[]) {
    blankMessages(cfg.messages[loc] as Record<string, unknown>)
  }
  await AppDataSource.getRepository(PageSetting).save({
    pageId: page.id,
    config: JSON.stringify(cfg),
  })

  void recordAudit(event, {
    action: 'page.create',
    outcome: 'success',
    actorType: 'user',
    userId: user.id,
    email: user.email,
    pageId: page.id,
    name: page.name,
    detail: { slug: page.slug },
  })

  return { page: { id: page.id, slug: page.slug, name: page.name } }
})
