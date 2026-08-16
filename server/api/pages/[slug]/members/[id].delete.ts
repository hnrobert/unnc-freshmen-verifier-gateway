import { AppDataSource } from '#server/utils/database'
import { PageMember } from '#server/entities/pageMember.entity'

/**
 * Remove a member. Manager+ — OR any member removing their own membership
 * (self-leave). Self-leave is allowed even for viewers.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { page, rank } = await requirePageRole(event, slug, RANK.viewer)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const repo = AppDataSource.getRepository(PageMember)
  const member = await repo.findOne({ where: { id, pageId: page.id } })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Collaborator not found' })

  const isSelf = member.userId === me.id
  if (!isSelf && rank < RANK.manager)
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  await repo.delete({ id })
  void recordAudit(event, {
    action: 'collaborator.remove',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    pageId: page.id,
    detail: {
      collaboratorId: id,
      invitedEmail: member.invitedEmail,
      role: member.role,
      self: isSelf,
    },
  })
  return { ok: true }
})
