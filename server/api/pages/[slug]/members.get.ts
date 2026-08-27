import { AppDataSource } from '#server/utils/database'
import { PageMember } from '#server/entities/pageMember.entity'
import { User } from '#server/entities/user.entity'

/** List the page's members (active + pending invites) + the owner. Manager+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.manager)

  const memberRepo = AppDataSource.getRepository(PageMember)
  const userRepo = AppDataSource.getRepository(User)

  const members = await memberRepo.find({ where: { pageId: page.id }, order: { createdAt: 'ASC' } })
  const userIds = members.filter((m) => m.userId !== null).map((m) => m.userId as number)
  const users = userIds.length ? await userRepo.find({ where: userIds.map((id) => ({ id })) }) : []
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]))

  const owner = await userRepo.findOneBy({ id: page.ownerId })
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
