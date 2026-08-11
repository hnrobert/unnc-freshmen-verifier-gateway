import { AppDataSource } from '#server/utils/database'
import { Organization } from '#server/entities/organization.entity'
import { OrgRedirect } from '#server/entities/orgRedirect.entity'
import { invalidateOrgConfig } from '#server/utils/orgs'
import { validateSlug } from '#shared/types'

/**
 * Update an org's name and/or slug (owner or superadmin only — gated by
 * requireOrgOwnership). On a slug change:
 *   - the previous slug is recorded in `org_redirects` → this org id, so the
 *     redirect middleware keeps old public URLs working (resolved to the live
 *     slug, so later renames chain automatically);
 *   - any leftover redirect on the newly-claimed slug is freed, fulfilling the
 *     "redirect stops when a new org uses the slug" contract;
 *   - both the old and new slug config caches are invalidated (image URLs embed
 *     the slug).
 * The redirect row is written AFTER the slug is mutated so a failed update can
 * never leave a self-referential entry (oldSlug → org that still owns oldSlug),
 * which the middleware guards against anyway.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await requireOrgOwnership(event, slug)
  const actor = requireAuth(event)

  const body = await readBody<{ name?: unknown; slug?: unknown }>(event)
  const nameRaw = body?.name == null ? undefined : String(body.name).trim()
  const slugRaw = body?.slug == null ? undefined : String(body.slug).trim().toLowerCase()

  if (nameRaw === undefined && slugRaw === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const orgRepo = AppDataSource.getRepository(Organization)
  const redirectRepo = AppDataSource.getRepository(OrgRedirect)
  let renamed = false
  let oldSlug: string | null = null

  // Name update (independent of slug).
  if (nameRaw !== undefined) {
    if (!nameRaw) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    if (nameRaw !== org.name) {
      await orgRepo.update(org.id, { name: nameRaw })
      org.name = nameRaw
    }
  }

  // Slug update.
  if (slugRaw !== undefined && slugRaw !== org.slug) {
    const slugError = validateSlug(slugRaw)
    if (slugError) throw createError({ statusCode: 400, statusMessage: slugError })
    // Must not collide with another org's current slug.
    const clash = await orgRepo.findOne({ where: { slug: slugRaw } })
    if (clash && clash.id !== org.id) {
      throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })
    }

    oldSlug = org.slug
    // Free any stale redirect pointed at the claimed slug first.
    await redirectRepo.delete({ oldSlug: slugRaw })
    // Mutate the slug, then record the redirect from the previous slug.
    await orgRepo.update(org.id, { slug: slugRaw })
    org.slug = slugRaw
    await redirectRepo.save({ oldSlug, orgId: org.id })

    renamed = true
    invalidateOrgConfig(oldSlug)
    invalidateOrgConfig(slugRaw)
  }

  void recordAudit(event, {
    action: 'org.rename',
    outcome: 'success',
    actorType: 'user',
    userId: actor.id,
    email: actor.email,
    orgId: org.id,
    name: org.name,
    detail: renamed ? { renamed, oldSlug, newSlug: org.slug } : { nameOnly: true },
  })

  return { org: { id: org.id, slug: org.slug, name: org.name }, renamed, oldSlug }
})
