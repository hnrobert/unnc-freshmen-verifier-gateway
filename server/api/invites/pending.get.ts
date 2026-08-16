import { AppDataSource } from '#server/utils/database'
import { PageMember } from '#server/entities/pageMember.entity'
import { Page } from '#server/entities/page.entity'

/** Pending invitations for the current user (matching their email). Session. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const members = await AppDataSource.getRepository(PageMember).find({
    where: { status: 'pending' },
  })
  const pending = members.filter((m) => m.invitedEmail.toLowerCase() === user.email.toLowerCase())
  const invitations: { token: string; pageName: string; slug: string; role: string }[] = []
  for (const m of pending) {
    if (!m.inviteToken) continue
    const page = await AppDataSource.getRepository(Page).findOneBy({ id: m.pageId })
    if (page)
      invitations.push({ token: m.inviteToken, pageName: page.name, slug: page.slug, role: m.role })
  }
  return { invitations }
})
