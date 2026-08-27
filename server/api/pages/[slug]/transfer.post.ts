import { AppDataSource } from '#server/utils/database'
import { Page } from '#server/entities/page.entity'
import { PageMember } from '#server/entities/pageMember.entity'

/**
 * Transfer ownership to an active member. Owner+ (superadmin may do it without
 * being demoted). The target becomes the new owner; the previous owner is demoted
 * to manager (if they were the owner) and the target's member row is removed
 * (ownership lives on Page.ownerId, not in page_members).
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.owner)

  const body = await readBody<{ memberId?: unknown }>(event)
  const memberId = Number(body?.memberId)
  if (!Number.isFinite(memberId))
    throw createError({ statusCode: 400, statusMessage: 'Invalid collaborator id' })

  const memberRepo = AppDataSource.getRepository(PageMember)
  const target = await memberRepo.findOne({
    where: { id: memberId, pageId: page.id, status: 'active' },
  })
  if (!target || target.userId === null)
    throw createError({ statusCode: 404, statusMessage: 'Active collaborator not found' })

  const newOwnerId = target.userId
  await AppDataSource.getRepository(Page).update(page.id, { ownerId: newOwnerId })

  // Demote the previous owner to manager (if it was the caller, not a superadmin).
  if (page.ownerId === me.id) {
    const prev = await memberRepo.findOne({ where: { pageId: page.id, userId: me.id } })
    if (prev) {
      prev.role = 'manager'
      prev.status = 'active'
      prev.inviteToken = null
      await memberRepo.save(prev)
    } else {
      await memberRepo.save({
        pageId: page.id,
        userId: me.id,
        invitedEmail: me.email,
        inviteToken: null,
        role: 'manager',
        status: 'active',
        invitedBy: me.id,
      })
    }
  }
  // The new owner no longer needs a member row.
  await memberRepo.delete({ id: target.id })

  void recordAudit(event, {
    action: 'page.transfer',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    pageId: page.id,
    detail: { fromOwnerId: page.ownerId, toOwnerId: newOwnerId },
  })

  return { ok: true, ownerId: newOwnerId }
})
