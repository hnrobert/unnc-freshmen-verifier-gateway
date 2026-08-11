import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { UserOrgNotificationPref } from '#server/entities/userOrgNotificationPref.entity'
import { loadOrgConfig } from '#server/utils/orgs'
import { resolveServerTz } from '#server/utils/serverTz'
import { resolveEffectivePref, sanitizeSlots, isValidReminderTime } from '#shared/lib/reminderPref'

/**
 * Update the caller's OWN per-org notification preference for this org. Viewer
 * floor — the route is self-scoped (`/me/`, no `:id`), so the only row touched
 * is the caller's. `inherit:true` deletes the override (back to account default);
 * otherwise the supplied fields are validated and upserted (un-supplied fields
 * are preserved). Returns the new override + the resolved effective schedule.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.viewer)

  const body = await readBody<{
    inherit?: unknown
    notifyExpiry?: unknown
    reminderSlots?: unknown
    reminderTime?: unknown
  }>(event)

  const repo = AppDataSource.getRepository(UserOrgNotificationPref)

  if (body.inherit === true) {
    await repo.delete({ orgId: org.id, userId: me.id })
  } else {
    const row =
      (await repo.findOneBy({ orgId: org.id, userId: me.id })) ??
      repo.create({
        orgId: org.id,
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
  const pref = await repo.findOneBy({ orgId: org.id, userId: me.id })
  const user = await AppDataSource.getRepository(User).findOneBy({ id: me.id })
  const config = await loadOrgConfig(org.slug)
  const effective = resolveEffectivePref({
    user: {
      notifyExpiry: !!user?.notifyExpiry,
      reminderSlots: user?.reminderSlots ?? null,
      reminderTime: user?.reminderTime ?? null,
      tz: user?.tz ?? null,
    },
    orgOverride: pref ?? null,
    orgConfig: {
      reminders: sanitizeSlots(config.welcome?.reminders),
      reminderTime: config.welcome?.reminderTime || null,
      reminderTz: config.welcome?.reminderTz || null,
    },
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
