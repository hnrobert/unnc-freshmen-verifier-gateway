import { AppDataSource } from '../../utils/database'
import { OrgMember } from '../../entities/orgMember.entity'
import { Organization } from '../../entities/organization.entity'

/** Public invite details for the landing page (no sensitive data). */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') as string
  const member = await AppDataSource.getRepository(OrgMember).findOne({
    where: { inviteToken: token },
  })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  const org = await AppDataSource.getRepository(Organization).findOneBy({ id: member.orgId })
  return {
    orgName: org?.name ?? 'an organization',
    slug: org?.slug ?? null,
    invitedEmail: member.invitedEmail,
    role: member.role,
    status: member.status,
    expired: !!(member.expiresAt && member.expiresAt < new Date()),
  }
})
