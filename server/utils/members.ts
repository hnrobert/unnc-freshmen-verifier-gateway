import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { Organization } from '../entities/organization.entity'
import { OrgMember } from '../entities/orgMember.entity'
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

export interface OrgAccess {
  org: Organization
  rank: number
  role: EffectiveRole | null
}

/**
 * Resolve the caller's access to an org by slug. Returns null only if the org
 * itself doesn't exist; otherwise returns an OrgAccess with rank 0 / role null
 * when the caller has no access (so callers can distinguish 404 from 403).
 */
export async function getOrgAccess(event: H3Event, slug: string): Promise<OrgAccess | null> {
  const org = await AppDataSource.getRepository(Organization).findOne({ where: { slug } })
  if (!org) return null

  const user = event.context.user as SessionUser | undefined
  if (!user) return { org, rank: 0, role: null }
  if (user.role === 'superadmin') return { org, rank: RANK.superadmin, role: 'superadmin' }
  if (org.ownerId === user.id) return { org, rank: RANK.owner, role: 'owner' }

  const member = await AppDataSource.getRepository(OrgMember).findOne({
    where: { orgId: org.id, userId: user.id, status: 'active' },
  })
  if (
    member &&
    (member.role === 'viewer' || member.role === 'editor' || member.role === 'manager')
  ) {
    return { org, rank: RANK[member.role], role: member.role }
  }
  return { org, rank: 0, role: null }
}

/** Throw 404 if the org is missing, 403 if the caller's rank is below `minRank`. */
export async function requireOrgRole(
  event: H3Event,
  slug: string,
  minRank: number,
): Promise<OrgAccess> {
  const access = await getOrgAccess(event, slug)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (access.rank < minRank) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return access
}

/** Owner-or-superadmin gate (used for delete + transfer). Returns the org. */
export async function requireOrgOwnership(event: H3Event, slug: string): Promise<Organization> {
  const access = await requireOrgRole(event, slug, RANK.owner)
  return access.org
}

/** All orgs a user can access (owned + actively shared), each tagged with role. */
export async function listAccessibleOrgs(
  userId: number,
): Promise<{ org: Organization; role: EffectiveRole }[]> {
  const orgRepo = AppDataSource.getRepository(Organization)
  const memberRepo = AppDataSource.getRepository(OrgMember)

  const [owned, memberships] = await Promise.all([
    orgRepo.find({ where: { ownerId: userId } }),
    memberRepo.find({ where: { userId, status: 'active' } }),
  ])

  const out: { org: Organization; role: EffectiveRole }[] = owned.map((o) => ({
    org: o,
    role: 'owner',
  }))
  const ownedIds = new Set(owned.map((o) => o.id))
  for (const m of memberships) {
    if (ownedIds.has(m.orgId)) continue
    const org = await orgRepo.findOne({ where: { id: m.orgId } })
    if (org && (m.role === 'viewer' || m.role === 'editor' || m.role === 'manager')) {
      out.push({ org, role: m.role })
    }
  }
  return out
}

// --- Invites ---

export function generateInviteToken(): string {
  return randomBytes(24).toString('hex')
}

/** Build the `/invite/<token>` URL using the host the visitor/browser reached. */
export function buildInviteUrl(event: H3Event, token: string): string {
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto = isSecureRequest(event) ? 'https' : 'http'
  return `${proto}://${host}/invite/${token}`
}

/**
 * Claim an invite: the logged-in user's email must match the invited email.
 * Activates the membership, clears the token. Throws 404/410/403 on problems.
 */
export async function claimInvite(token: string, user: SessionUser): Promise<OrgMember> {
  const repo = AppDataSource.getRepository(OrgMember)
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
