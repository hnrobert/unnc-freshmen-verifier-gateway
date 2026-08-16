import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { UserPageNotificationPref } from '#server/entities/userPageNotificationPref.entity'
import { resolveServerTz } from '#server/utils/serverTz'
import { resolveEffectivePref, sanitizeSlots, isValidReminderTime } from '#shared/lib/reminderPref'

/**
 * Update the caller's OWN per-page notification preference for this page. Viewer
 * floor — the route is self-scoped (`/me/`, no `:id`), so the only row touched
 * is the caller's. `inherit:true` deletes the override (back to account default);
 * otherwise the supplied fields are validated and upserted (un-supplied fields
 * are preserved). Returns the new override + the resolved effective schedule.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.viewer)

  const body = await readBody<{
    inherit?: unknown
    notifyExpiry?: unknown
    reminderSlots?: unknown
    reminderTime?: unknown
  }>(event)

  const repo = AppDataSource.getRepository(UserPageNotificationPref)

  if (body.inherit === true) {
    await repo.delete({ pageId: page.id, userId: me.id })
  } else {
    const row =
      (await repo.findOneBy({ pageId: page.id, userId: me.id })) ??
      repo.create({
        pageId: page.id,
        userId: me.id,
        notifyExpiry: null,
        reminderSlots: null,
        reminderTime: null,
      })

    if (body.notifyExpiry !== undefined) {
      row.notifyExpiry = body.notifyExpiry === null ? null : !!body.notifyExpiry
    }
    if (body.reminderSlots !== undefined) {
      row.reminderSlots = body.reminderSlots === null ? null : sanitizeSlots(body.reminderSlots)
    }
    if (body.reminderTime !== undefined) {
      if (body.reminderTime === null || body.reminderTime === '') row.reminderTime = null
      else {
        const t = String(body.reminderTime)
        if (!isValidReminderTime(t))
          throw createError({ statusCode: 400, statusMessage: 'Time must be HH:MM (24-hour)' })
        row.reminderTime = t
      }
    }
    await repo.save(row)
  }

  // Return the resulting override + effective schedule.
  const pref = await repo.findOneBy({ pageId: page.id, userId: me.id })
  const user = await AppDataSource.getRepository(User).findOneBy({ id: me.id })
  const effective = resolveEffectivePref({
    user: {
      notifyExpiry: !!user?.notifyExpiry,
      reminderSlots: user?.reminderSlots ?? null,
      reminderTime: user?.reminderTime ?? null,
      tz: user?.tz ?? null,
    },
    pageOverride: pref ?? null,
    serverTz: resolveServerTz(),
  })

  return {
    override: pref
      ? {
          notifyExpiry: pref.notifyExpiry,
          reminderSlots: pref.reminderSlots,
          reminderTime: pref.reminderTime,
        }
      : null,
    effective,
  }
})
