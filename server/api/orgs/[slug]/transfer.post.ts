import { AppDataSource } from '../../../utils/database'
import { Organization } from '../../../entities/organization.entity'
import { OrgMember } from '../../../entities/orgMember.entity'

/**
 * Transfer ownership to an active member. Owner+ (superadmin may do it without
 * being demoted). The target becomes the new owner; the previous owner is demoted
 * to manager (if they were the owner) and the target's member row is removed
 * (ownership lives on Organization.ownerId, not in org_members).
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.owner)

  const body = await readBody<{ memberId?: unknown }>(event)
  const memberId = Number(body?.memberId)
  if (!Number.isFinite(memberId))
    throw createError({ statusCode: 400, statusMessage: 'Invalid memberId' })

  const memberRepo = AppDataSource.getRepository(OrgMember)
  const target = await memberRepo.findOne({
    where: { id: memberId, orgId: org.id, status: 'active' },
  })
  if (!target || target.userId === null)
    throw createError({ statusCode: 404, statusMessage: 'Active member not found' })

  const newOwnerId = target.userId
  await AppDataSource.getRepository(Organization).update(org.id, { ownerId: newOwnerId })

  // Demote the previous owner to manager (if it was the caller, not a superadmin).
  if (org.ownerId === me.id) {
    const prev = await memberRepo.findOne({ where: { orgId: org.id, userId: me.id } })
    if (prev) {
      prev.role = 'manager'
      prev.status = 'active'
      prev.inviteToken = null
      await memberRepo.save(prev)
    } else {
      await memberRepo.save({
        orgId: org.id,
        userId: me.id,
        invitedEmail: me.email,
        inviteToken: null,
        role: 'manager',
        status: 'active',
        invitedBy: me.id,
      })
    }
  }
  // The new owner no longer needs a member row.
  await memberRepo.delete({ id: target.id })

  return { ok: true, ownerId: newOwnerId }
})
