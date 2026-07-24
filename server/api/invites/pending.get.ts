import { AppDataSource } from '#server/utils/database'
import { OrgMember } from '#server/entities/orgMember.entity'
import { Organization } from '#server/entities/organization.entity'

/** Pending invitations for the current user (matching their email). Session. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const members = await AppDataSource.getRepository(OrgMember).find({
    where: { status: 'pending' },
  })
  const pending = members.filter((m) => m.invitedEmail.toLowerCase() === user.email.toLowerCase())
  const invitations: { token: string; orgName: string; slug: string; role: string }[] = []
  for (const m of pending) {
    if (!m.inviteToken) continue
    const org = await AppDataSource.getRepository(Organization).findOneBy({ id: m.orgId })
    if (org)
      invitations.push({ token: m.inviteToken, orgName: org.name, slug: org.slug, role: m.role })
  }
  return { invitations }
})
