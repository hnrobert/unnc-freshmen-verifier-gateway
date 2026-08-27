import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { Page } from '#server/entities/page.entity'
import { PageMember } from '#server/entities/pageMember.entity'
import { isSecureRequest } from './request'
import type { SessionUser } from './auth'

export type MemberRole = 'viewer' | 'editor' | 'manager'
export type EffectiveRole = MemberRole | 'owner' | 'superadmin'

/** Role rank for permission comparisons. superadmin bypasses everything. */
export const RANK: Record<EffectiveRole, number> = {
  viewer: 1,
  editor: 2,
  manager: 3,
  owner: 4,
  superadmin: 999,
}

export const MEMBER_ROLES: MemberRole[] = ['viewer', 'editor', 'manager']
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface PageAccess {
  page: Page
  rank: number
  role: EffectiveRole | null
}

/**
 * Resolve the caller's access to an page by slug. Returns null only if the page
 * itself doesn't exist; otherwise returns an PageAccess with rank 0 / role null
 * when the caller has no access (so callers can distinguish 404 from 403).
 */
export async function getPageAccess(event: H3Event, slug: string): Promise<PageAccess | null> {
  const page = await AppDataSource.getRepository(Page).findOne({ where: { slug } })
  if (!page) return null

  const user = event.context.user as SessionUser | undefined
  if (!user) return { page, rank: 0, role: null }
  if (user.role === 'superadmin') return { page, rank: RANK.superadmin, role: 'superadmin' }
  if (page.ownerId === user.id) return { page, rank: RANK.owner, role: 'owner' }

  const member = await AppDataSource.getRepository(PageMember).findOne({
    where: { pageId: page.id, userId: user.id, status: 'active' },
  })
  if (
    member &&
    (member.role === 'viewer' || member.role === 'editor' || member.role === 'manager')
  ) {
    return { page, rank: RANK[member.role], role: member.role }
  }
  return { page, rank: 0, role: null }
}

/** Throw 404 if the page is missing, 403 if the caller's rank is below `minRank`. */
export async function requirePageRole(
  event: H3Event,
  slug: string,
  minRank: number,
): Promise<PageAccess> {
  const access = await getPageAccess(event, slug)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  if (access.rank < minRank) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return access
}

/** Owner-or-superadmin gate (used for delete + transfer). Returns the page. */
export async function requirePageOwnership(event: H3Event, slug: string): Promise<Page> {
  const access = await requirePageRole(event, slug, RANK.owner)
  return access.page
}

/** All pages a user can access (owned + actively shared), each tagged with role. */
export async function listAccessiblePages(
  userId: number,
): Promise<{ page: Page; role: EffectiveRole }[]> {
  const pageRepo = AppDataSource.getRepository(Page)
  const memberRepo = AppDataSource.getRepository(PageMember)

  // Lists the pages to show on a user's dashboard / Pages page: those
  // they own ∪ active memberships. Superadmins are NOT special-cased here (they
  // see their own pages like anyone else) — the site-wide "all pages" view is the
  // admin panel. Superadmins can still *access* any page via getPageAccess.
  const [owned, memberships] = await Promise.all([
    pageRepo.find({ where: { ownerId: userId } }),
    memberRepo.find({ where: { userId, status: 'active' } }),
  ])

  const out: { page: Page; role: EffectiveRole }[] = owned.map((o) => ({
    page: o,
    role: 'owner',
  }))
  const ownedIds = new Set(owned.map((o) => o.id))
  for (const m of memberships) {
    if (ownedIds.has(m.pageId)) continue
    const page = await pageRepo.findOne({ where: { id: m.pageId } })
    if (page && (m.role === 'viewer' || m.role === 'editor' || m.role === 'manager')) {
      out.push({ page, role: m.role })
    }
  }
  return out
}

// --- Invites ---

export function generateInviteToken(): string {
  return randomBytes(24).toString('hex')
}

/** Build the `/<slug>/invitations` URL (GitHub-style, no token in URL). */
export function buildInviteUrl(event: H3Event, slug: string): string {
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto = isSecureRequest(event) ? 'https' : 'http'
  return `${proto}://${host}/${slug}/invitations`
}

/**
 * Claim an invite: the logged-in user's email must match the invited email.
 * Activates the membership, clears the token. Throws 404/410/403 on problems.
 */
export async function claimInvite(token: string, user: SessionUser): Promise<PageMember> {
  const repo = AppDataSource.getRepository(PageMember)
  const member = await repo.findOne({ where: { inviteToken: token } })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  if (member.status === 'active')
    throw createError({ statusCode: 410, statusMessage: 'Invitation has already been used' })
  if (member.expiresAt && member.expiresAt < new Date())
    throw createError({ statusCode: 410, statusMessage: 'Invitation has expired' })
  if (member.invitedEmail.toLowerCase() !== user.email.toLowerCase())
    throw createError({
      statusCode: 403,
      statusMessage: 'This invitation is for a different email address',
    })

  member.userId = user.id
  member.status = 'active'
  member.inviteToken = null
  member.acceptedAt = new Date()
  await repo.save(member)
  return member
}

/** Decline (delete) a pending invite. Validates email match + not-yet-active. */
export async function declineInvite(token: string, user: SessionUser): Promise<void> {
  const repo = AppDataSource.getRepository(PageMember)
  const member = await repo.findOne({ where: { inviteToken: token } })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  if (member.status === 'active')
    throw createError({ statusCode: 410, statusMessage: 'Invitation has already been used' })
  if (member.invitedEmail.toLowerCase() !== user.email.toLowerCase())
    throw createError({
      statusCode: 403,
      statusMessage: 'This invitation is for a different email address',
    })
  await repo.delete({ id: member.id })
}
