import { AppDataSource } from '#server/utils/database'
import { Organization } from '#server/entities/organization.entity'
import { OrgRedirect } from '#server/entities/orgRedirect.entity'
import { SLUG_RE, RESERVED_SLUGS } from '#shared/types'

/**
 * Old-slug → current-slug redirect for public org URLs. When an org is renamed,
 * a row in `org_redirects` maps its previous slug → the org id; this middleware
 * resolves that id to the org's CURRENT slug and 302s the visitor there, so old
 * links/posters keep working. The redirect stops once a new org claims the old
 * slug (org create/rename frees the row) or the org is deleted.
 *
 * Scoped to public, read-only navigation: skips non-GET/HEAD methods, /api,
 * /dashboard, reserved top-level segments, and anything that isn't a
 * slug-shaped first segment. We use a non-permanent 302 (with no-store) because
 * the mapping is meant to be revocable — a cached 301 would keep redirecting
 * even after a new org reclaims the slug.
 */
export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'HEAD') return

  // event.path includes the query string; split it off so we can re-append it.
  const raw = event.path ?? ''
  const qIdx = raw.indexOf('?')
  const path = qIdx >= 0 ? raw.slice(0, qIdx) : raw
  const search = qIdx >= 0 ? raw.slice(qIdx) : ''

  const parts = path.split('/')
  const seg = parts[1] ?? ''
  if (!seg || !SLUG_RE.test(seg) || RESERVED_SLUGS.has(seg)) return

  const redirectRepo = AppDataSource.getRepository(OrgRedirect)
  const row = await redirectRepo.findOne({ where: { oldSlug: seg } })
  if (!row) return

  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: row.orgId })
  // Stale entry: the org is gone, or now owns this slug directly (renamed back).
  // Drop the row and let normal routing handle the request.
  if (!org || org.slug === seg) {
    await redirectRepo.delete({ oldSlug: seg })
    return
  }

  const rest = parts.slice(2).join('/')
  const target = '/' + org.slug + (rest ? '/' + rest : '') + search
  setResponseHeader(event, 'cache-control', 'no-store')
  return sendRedirect(event, target, 302)
})
