import { AppDataSource } from '#server/utils/database'
import { AppSetting } from '#server/entities/appSetting.entity'

/**
 * One-shot cutover for the per-user reminder dedupe key.
 *
 * `synchronize:true` adds the new `user_id` column and the new 4-column unique
 * index `(pageId, userId, expiresAt, kind)`, but it will NOT drop the legacy
 * 3-column unique index `(pageId, expiresAt, kind)` from the page-centric era.
 * Left in place, that legacy index would make per-user sending impossible (two
 * users of one page sharing a slot would collide on the old 3-column key).
 *
 * So, once, at boot: truncate the transient dedupe log (worst case = one extra
 * reminder per active slot in the current 24h window) and drop the legacy index.
 * Gated by an `app_settings` flag so it never repeats. Runs after `01.db.ts`
 * (schema is built) and well before `02.reminders.ts`'s first 30s tick.
 */
const FLAG_KEY = 'reminderMigrationV1'

export default defineNitroPlugin(async () => {
  if (!AppDataSource.isInitialized) return
  const settingRepo = AppDataSource.getRepository(AppSetting)
  try {
    const done = await settingRepo.findOneBy({ key: FLAG_KEY })
    if (done) return

    await AppDataSource.query('DELETE FROM page_reminder_sents')
    await AppDataSource.query('DROP INDEX IF EXISTS uq_org_reminder_org_date_kind')

    // Idempotent against an unlikely boot race.
    await settingRepo.upsert({ key: FLAG_KEY, value: 'done' }, ['key'])

    console.log(
      '[reminders] migration v1 · truncated org_reminder_sents + dropped legacy 3-column index',
    )
  } catch (e) {
    console.error('[reminders] migration v1 failed:', e)
  }
})
