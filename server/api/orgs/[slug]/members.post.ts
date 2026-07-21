import { AppDataSource } from '#server/utils/database'
import { OrgMember } from '#server/entities/orgMember.entity'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ROLES = ['viewer', 'editor', 'manager'] as const

/** Invite a user by email (creates a pending member + one-time token). Manager+. */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { org, rank } = await requireOrgRole(event, slug, RANK.manager)

  const body = await readBody<{ email?: unknown; role?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const role = String(body?.role ?? 'viewer')
  if (!EMAIL_RE.test(email)) throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  if (!(ROLES as readonly string[]).includes(role))
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  // Only the owner may grant the manager role (prevent privilege escalation).
  if (role === 'manager' && rank < RANK.owner)
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can invite a manager' })

  const repo = AppDataSource.getRepository(OrgMember)
  const existing = await repo.findOne({ where: { orgId: org.id, invitedEmail: email } })
  if (existing)
    throw createError({ statusCode: 409, statusMessage: 'That email has already been invited' })

  const token = generateInviteToken()
  const member = await repo.save({
    orgId: org.id,
    userId: null,
    invitedEmail: email,
    inviteToken: token,
    role,
    status: 'pending',
    invitedBy: me.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  })
  return { id: member.id, inviteUrl: buildInviteUrl(event, token) }
})
