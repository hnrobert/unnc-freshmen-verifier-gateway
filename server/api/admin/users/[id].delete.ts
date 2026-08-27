import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { Session } from '#server/entities/session.entity'
import { Passkey } from '#server/entities/passkey.entity'
import { MailConfig } from '#server/entities/mailConfig.entity'
import { PageMember } from '#server/entities/pageMember.entity'
import { Page } from '#server/entities/page.entity'

/**
 * Permanently delete a user account (superadmin only).
 *
 * Side effects, all in one transaction:
 *  - Ownership of any pages they owned is reassigned to the acting superadmin
 *    (`pages.owner_id` is non-nullable, so we can't just orphan them).
 *  - Personal artifacts are removed: sessions, passkeys, per-user mail config,
 *    and their active page memberships.
 *  - Page analytics + verified-identity records (`page_events`,
 *    `page_verified_identities`) are KEPT — they belong to the page's history,
 *    not the user's account, and are page-scoped (no `userId`).
 *
 * Guards: cannot delete yourself; cannot delete the last superadmin.
 */
export default defineEventHandler(async (event) => {
  const me = requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  if (id === me.id)
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own account' })

  const userRepo = AppDataSource.getRepository(User)
  const target = await userRepo.findOneBy({ id })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // Never let the system lose its last superadmin (would lock out management).
  if (target.role === 'superadmin') {
    const superadminCount = await userRepo.countBy({ role: 'superadmin' })
    if (superadminCount <= 1)
      throw createError({ statusCode: 400, statusMessage: 'Cannot delete the last superadmin' })
  }

  const reassignedPages = await AppDataSource.transaction(async (m) => {
    const pageRepo = m.getRepository(Page)
    const ownedPages = await pageRepo.countBy({ ownerId: id })
    if (ownedPages > 0) await pageRepo.update({ ownerId: id }, { ownerId: me.id })

    await m.getRepository(Session).delete({ userId: id })
    await m.getRepository(Passkey).delete({ userId: id })
    await m.getRepository(MailConfig).delete({ userId: id })
    await m.getRepository(PageMember).delete({ userId: id })
    await m.getRepository(User).delete({ id })
    return ownedPages
  })

  void recordAudit(event, {
    action: 'admin.user_delete',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    detail: {
      targetUserId: target.id,
      targetEmail: target.email,
      targetRole: target.role,
      reassignedPages,
    },
  })

  return { ok: true, reassignedPages }
})
