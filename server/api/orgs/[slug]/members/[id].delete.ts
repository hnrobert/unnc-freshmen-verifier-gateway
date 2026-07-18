import { AppDataSource } from '../../../../utils/database'
import { OrgMember } from '../../../../entities/orgMember.entity'

/**
 * Remove a member. Manager+ — OR any member removing their own membership
 * (self-leave). Self-leave is allowed even for viewers.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { org, rank } = await requireOrgRole(event, slug, RANK.viewer)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const repo = AppDataSource.getRepository(OrgMember)
  const member = await repo.findOne({ where: { id, orgId: org.id } })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Member not found' })

  const isSelf = member.userId === me.id
  if (!isSelf && rank < RANK.manager)
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  await repo.delete({ id })
  return { ok: true }
})
