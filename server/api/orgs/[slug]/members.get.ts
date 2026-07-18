import { AppDataSource } from '../../../utils/database'
import { OrgMember } from '../../../entities/orgMember.entity'
import { User } from '../../../entities/user.entity'

/** List the org's members (active + pending invites) + the owner. Manager+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.manager)

  const memberRepo = AppDataSource.getRepository(OrgMember)
  const userRepo = AppDataSource.getRepository(User)

  const members = await memberRepo.find({ where: { orgId: org.id }, order: { createdAt: 'ASC' } })
  const userIds = members.filter((m) => m.userId !== null).map((m) => m.userId as number)
  const users = userIds.length ? await userRepo.find({ where: userIds.map((id) => ({ id })) }) : []
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]))

  const owner = await userRepo.findOneBy({ id: org.ownerId })
  return {
    owner: { email: owner?.email ?? 'unknown', role: 'owner' },
    members: members.map((m) => ({
      id: m.id,
      email:
        m.status === 'active' && m.userId !== null
          ? (emailByUserId.get(m.userId) ?? m.invitedEmail)
          : m.invitedEmail,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      acceptedAt: m.acceptedAt,
    })),
  }
})
