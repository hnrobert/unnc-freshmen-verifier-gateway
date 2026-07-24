import { AppDataSource } from '#server/utils/database'
import { Organization } from '#server/entities/organization.entity'
import { OrgMember } from '#server/entities/orgMember.entity'

/** Returns the pending invitation for the current user (by email) on this org.
 *  Session. 404 if no pending invite — GitHub-style: the page only shows for
 *  the invited person. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string

  const org = await AppDataSource.getRepository(Organization).findOne({ where: { slug } })
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  const member = await AppDataSource.getRepository(OrgMember).findOne({
    where: {
      orgId: org.id,
      invitedEmail: user.email.toLowerCase(),
      status: 'pending',
    },
  })
  if (!member || !member.inviteToken)
    throw createError({ statusCode: 404, statusMessage: 'No pending invitation' })

  return {
    orgName: org.name,
    slug: org.slug,
    role: member.role,
    inviteToken: member.inviteToken,
  }
})
