import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { PageRedirect } from '#server/entities/pageRedirect.entity'
import { invalidatePageConfig } from '#server/utils/pages'
import { validateSlug } from '#shared/types'

/**
 * Update an page's name and/or slug (owner or superadmin only — gated by
 * requirePageOwnership). On a slug change:
 *   - the previous slug is recorded in `page_redirects` → this page id, so the
 *     redirect middleware keeps old public URLs working (resolved to the live
 *     slug, so later renames chain automatically);
 *   - any leftover redirect on the newly-claimed slug is freed, fulfilling the
 *     "redirect stops when a new page uses the slug" contract;
 *   - both the old and new slug config caches are invalidated (image URLs embed
 *     the slug).
 * The redirect row is written AFTER the slug is mutated so a failed update can
 * never leave a self-referential entry (oldSlug → page that still owns oldSlug),
 * which the middleware guards against anyway.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const page = await requirePageOwnership(event, slug)
  const actor = requireAuth(event)

  const body = await readBody<{ name?: unknown; slug?: unknown }>(event)
  const nameRaw = body?.name == null ? undefined : String(body.name).trim()
  const slugRaw = body?.slug == null ? undefined : String(body.slug).trim().toLowerCase()

  if (nameRaw === undefined && slugRaw === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const pageRepo = AppDataSource.getRepository(Page)
  const redirectRepo = AppDataSource.getRepository(PageRedirect)
  let renamed = false
  let oldSlug: string | null = null

  // Name update (independent of slug).
  if (nameRaw !== undefined) {
    if (!nameRaw) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    if (nameRaw !== page.name) {
      await pageRepo.update(page.id, { name: nameRaw })
      page.name = nameRaw
    }
  }

  // Slug update.
  if (slugRaw !== undefined && slugRaw !== page.slug) {
    const slugError = validateSlug(slugRaw)
    if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
    // Must not collide with another page's current slug.
    const clash = await pageRepo.findOne({ where: { slug: slugRaw } })
    if (clash && clash.id !== page.id) {
      throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })
    }

    oldSlug = page.slug
    // Free any stale redirect pointed at the claimed slug first.
    await redirectRepo.delete({ oldSlug: slugRaw })
    // Mutate the slug, then record the redirect from the previous slug.
    await pageRepo.update(page.id, { slug: slugRaw })
    page.slug = slugRaw
    await redirectRepo.save({ oldSlug, pageId: page.id })

    renamed = true
    invalidatePageConfig(oldSlug)
    invalidatePageConfig(slugRaw)
  }

  void recordAudit(event, {
    action: 'page.rename',
    outcome: 'success',
    actorType: 'user',
    userId: actor.id,
    email: actor.email,
    pageId: page.id,
    name: page.name,
    detail: renamed ? { renamed, oldSlug, newSlug: page.slug } : { nameOnly: true },
  })

  return { page: { id: page.id, slug: page.slug, name: page.name }, renamed, oldSlug }
})
