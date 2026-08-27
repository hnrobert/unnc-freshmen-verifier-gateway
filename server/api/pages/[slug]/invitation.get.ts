import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { PageMember } from '#server/entities/pageMember.entity'

/** Returns the pending invitation for the current user (by email) on this page.
 *  Session. 404 if no pending invite — GitHub-style: the page only shows for
 *  the invited person. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string

  const page = await AppDataSource.getRepository(Page).findOne({ where: { slug } })
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

  const member = await AppDataSource.getRepository(PageMember).findOne({
    where: {
      pageId: page.id,
      invitedEmail: user.email.toLowerCase(),
      status: 'pending',
    },
  })
  if (!member || !member.inviteToken)
    throw createError({ statusCode: 404, statusMessage: 'No pending invitation' })

  return {
    pageName: page.name,
    slug: page.slug,
    role: member.role,
    inviteToken: member.inviteToken,
  }
})
