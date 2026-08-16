import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { UserPageNotificationPref } from '#server/entities/userPageNotificationPref.entity'
import { loadPageConfig } from '#server/utils/pages'
import { resolveServerTz } from '#server/utils/serverTz'
import { resolveEffectivePref } from '#shared/lib/reminderPref'

/**
 * The caller's per-page notification preference for this page, plus the
 * server-resolved *effective* schedule (exactly what the scheduler will do).
 * Viewer floor — every member role (and the owner) can read their own preference.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.viewer)

  const prefRepo = AppDataSource.getRepository(UserPageNotificationPref)
  const existing = await prefRepo.findOneBy({ pageId: page.id, userId: me.id })

  const user = await AppDataSource.getRepository(User).findOneBy({ id: me.id })
  const config = await loadPageConfig(page.slug)
  const effective = resolveEffectivePref({
    user: {
      notifyExpiry: !!user?.notifyExpiry,
      reminderSlots: user?.reminderSlots ?? null,
      reminderTime: user?.reminderTime ?? null,
      tz: user?.tz ?? null,
    },
    pageOverride: existing ?? null,
    serverTz: resolveServerTz(),
  })

  return {
    pageName: page.name,
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
