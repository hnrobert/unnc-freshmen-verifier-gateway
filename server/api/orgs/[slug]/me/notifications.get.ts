import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { UserOrgNotificationPref } from '#server/entities/userOrgNotificationPref.entity'
import { loadOrgConfig } from '#server/utils/orgs'
import { resolveServerTz } from '#server/utils/serverTz'
import { resolveEffectivePref, sanitizeSlots } from '#shared/lib/reminderPref'

/**
 * The caller's per-org notification preference for this org, plus the
 * server-resolved *effective* schedule (exactly what the scheduler will do).
 * Viewer floor — every member role (and the owner) can read their own preference.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.viewer)

  const prefRepo = AppDataSource.getRepository(UserOrgNotificationPref)
  const existing = await prefRepo.findOneBy({ orgId: org.id, userId: me.id })

  const user = await AppDataSource.getRepository(User).findOneBy({ id: me.id })
  const config = await loadOrgConfig(org.slug)
  const effective = resolveEffectivePref({
    user: {
      notifyExpiry: !!user?.notifyExpiry,
      reminderSlots: user?.reminderSlots ?? null,
      reminderTime: user?.reminderTime ?? null,
      tz: user?.tz ?? null,
    },
    orgOverride: existing ?? null,
    orgConfig: {
      reminders: sanitizeSlots(config.welcome?.reminders),
      reminderTime: config.welcome?.reminderTime || null,
      reminderTz: config.welcome?.reminderTz || null,
    },
    serverTz: resolveServerTz(),
  })

  return {
    orgName: org.name,
    expiresAt: config.welcome?.expiresAt ?? null,
    override: existing
      ? {
          notifyExpiry: existing.notifyExpiry,
          reminderSlots: existing.reminderSlots,
          reminderTime: existing.reminderTime,
        }
      : null,
    effective,
  }
})
