import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { Session } from '#server/entities/session.entity'
import { Passkey } from '#server/entities/passkey.entity'
import { MailConfig } from '#server/entities/mailConfig.entity'
import { OrgMember } from '#server/entities/orgMember.entity'
import { Organization } from '#server/entities/organization.entity'

/**
 * Permanently delete a user account (superadmin only).
 *
 * Side effects, all in one transaction:
 *  - Ownership of any orgs they owned is reassigned to the acting superadmin
 *    (`organizations.owner_id` is non-nullable, so we can't just orphan them).
 *  - Personal artifacts are removed: sessions, passkeys, per-user mail config,
 *    and their active org memberships.
 *  - Org analytics + verified-identity records (`org_events`,
 *    `org_verified_identities`) are KEPT — they belong to the org's history,
 *    not the user's account, and are org-scoped (no `userId`).
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

  const reassignedOrgs = await AppDataSource.transaction(async (m) => {
    const orgRepo = m.getRepository(Organization)
    const ownedOrgs = await orgRepo.countBy({ ownerId: id })
    if (ownedOrgs > 0) await orgRepo.update({ ownerId: id }, { ownerId: me.id })

    await m.getRepository(Session).delete({ userId: id })
    await m.getRepository(Passkey).delete({ userId: id })
    await m.getRepository(MailConfig).delete({ userId: id })
    await m.getRepository(OrgMember).delete({ userId: id })
    await m.getRepository(User).delete({ id })
    return ownedOrgs
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
      reassignedOrgs,
    },
  })

  return { ok: true, reassignedOrgs }
})
