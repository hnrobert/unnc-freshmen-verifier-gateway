import { AppDataSource } from '#server/utils/database'
import { OrgMember } from '#server/entities/orgMember.entity'

const ROLES = ['viewer', 'editor', 'manager'] as const

/** Change a member's role. Manager+. Only the owner may promote to manager. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { org, rank } = await requireOrgRole(event, slug, RANK.manager)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const body = await readBody<{ role?: unknown }>(event)
  const role = String(body?.role ?? '')
  if (!(ROLES as readonly string[]).includes(role))
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  if (role === 'manager' && rank < RANK.owner)
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the owner can grant the manager role',
    })

  const repo = AppDataSource.getRepository(OrgMember)
  const member = await repo.findOne({ where: { id, orgId: org.id } })
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Member not found' })

  member.role = role
  await repo.save(member)
  return { id: member.id, role: member.role }
})
