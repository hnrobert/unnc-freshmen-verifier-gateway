/**
 * QR-expiry reminder system: two halves that together make an page's
 * `welcome.expiresAt` actually do something.
 *
 *  • {@link autoEnableRemindersFromImages} — runs once at startup: OCR-scans each
 *    page's welcome image for an expiry date and, when one is found, fills
 *    `expiresAt` (only when empty — a manual date is never overwritten).
 *  • {@link sendDueReminders} — the scheduler tick (every few minutes):
 *    **per-user** scheduling. Each recipient (owner + active members) is reminded
 *    on their own resolved schedule — slots + time-of-day in their own timezone —
 *    derived through `resolveEffectivePref` (per-page override → account default →
 *    system default of `['-2d','-1d','day-of']` @ 12:00 server-tz; the page itself
 *    only supplies the expiry date). Each send is recorded in `PageReminderSent`
 *    keyed by `(pageId, userId, expiresAt, kind)` so it never repeats and is
 *    race-safe across instances.
 *
 * Reminder targets are resolved to UTC instants in each user's timezone: when a
 * user sets their tz, their targets fire at that wall-clock regardless of the
 * server's own timezone (e.g. a UTC host fires "12:00 Asia/Shanghai" at 04:00Z);
 * when the user has no tz, the server's local zone is used (see
 * `resolveServerTz`). `qrExpiry.ts` OCR dates remain server-local calendar days.
 * Everything is best-effort: OCR failures, missing mail config, or no opted-in
 * recipients degrade to a silent no-op rather than crashing the scheduler.
 */
import { In } from 'typeorm'
import { AppDataSource } from './database'
import { Page } from '#server/entities/page.entity'
import { PageSetting } from '#server/entities/pageSetting.entity'
import { PageImage } from '#server/entities/pageImage.entity'
import { PageMember } from '#server/entities/pageMember.entity'
import { PageReminderSent } from '#server/entities/pageReminderSent.entity'
import { User } from '#server/entities/user.entity'
import { UserPageNotificationPref } from '#server/entities/userPageNotificationPref.entity'
import type { Locale, ReminderSlot, SiteConfig } from '#shared/types'
import { detectWelcomeExpiry } from './ocr'
import { toLocalDateStr } from './qrExpiry'
import { invalidatePageConfig } from './pages'
import { resolveServerTz } from './serverTz'
import { renderEmail } from '#server/mail/render'
import { getMailConfig, sendMailWithConfig } from './mail'
import { getSiteOrigin } from './siteOrigin'
import { shiftCalendarDate, zonedDateTimeToUtcMs } from '#shared/lib/reminderTz'
import { resolveEffectivePref } from '#shared/lib/reminderPref'

/** How often the scheduler wakes to check for due reminders. */
export const REMINDER_TICK_MS = 5 * 60 * 1000
/** A reminder fires once within [target, target + WINDOW) — lenient so a few
 * hours of downtime don't cause a miss, bounded so a fresh deploy doesn't emit
 * a burst of long-stale reminders. */
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000
/** Default time-of-day (HH:MM) when a user preference doesn't supply one. */
const DEFAULT_REMINDER_TIME = '12:00'

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** 'YYYY-MM-DD' → human display in the given locale. */
function formatExpiryDate(expiresAt: string, locale: Locale): string {
  const parts = expiresAt.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return locale === 'zh' ? `${y}年${m}月${d}日` : `${MONTHS_EN[m - 1] ?? ''} ${d}, ${y}`
}

/** Absolute URL to the page's edit page (so the recipient can refresh the QR). */
function pageUrl(slug: string, base: string): string {
  return `${base}/dashboard/${slug}/edit`
}

/** The epoch instant a given reminder slot should fire — at `reminderTime`
 * (HH:MM, default noon) interpreted in `tz` (IANA) on its day. `-Nd` → N days
 * before `expiresAt` (rolls back across the month boundary); `day-of` → on
 * `expiresAt`. */
function reminderTarget(
  expiresAt: string,
  slot: ReminderSlot,
  reminderTime: string | undefined,
  tz: string,
): number {
  const offset = slot === 'day-of' ? 0 : -Number.parseInt(slot.slice(1), 10)
  // Shift the calendar day (timezone-independent), then resolve the wall-clock
  // in `tz` to a UTC instant.
  const dateStr = shiftCalendarDate(expiresAt, offset)
  return zonedDateTimeToUtcMs(dateStr, reminderTime || DEFAULT_REMINDER_TIME, tz)
}

/** Build the localized reminder email (subject + themed HTML) for one recipient,
 * using the page's customizable `email.*` text. */
function reminderEmail(
  config: SiteConfig,
  locale: Locale,
  slot: ReminderSlot,
  pageName: string,
  expiresAt: string,
  slug: string,
  base: string,
): { subject: string; html: string } {
  const dateStr = formatExpiryDate(expiresAt, locale)
  const n = String(Number.parseInt(slot.slice(1), 10))
  const title =
    slot === 'day-of'
      ? emailMsg(config, locale, 'reminderTitleToday')
      : slot === '-1d'
        ? emailMsg(config, locale, 'reminderTitleTomorrow')
        : tpl(emailMsg(config, locale, 'reminderTitleInDays'), { n })
  const bodyHtml = `<p>${tpl(emailMsg(config, locale, 'reminderBody'), {
    org: `<strong>${escapeHtml(pageName)}</strong>`,
    date: `<strong>${dateStr}</strong>`,
  })}</p>`
  const html = renderEmail({
    title,
    bodyHtml,
    actionLabel: emailMsg(config, locale, 'reminderButton'),
    actionUrl: pageUrl(slug, base),
    preheader: title,
  })
  return { subject: `${pageName} · ${title}`, html }
}

// ---------------------------------------------------------------------------
// Part A — startup auto-detect + enable
// ---------------------------------------------------------------------------

/**
 * For every page with no expiry date yet, try to read one from the welcome image
 * via OCR and set `welcome.expiresAt` (only when empty — a manual date is never
 * overwritten). Reminder schedules are per-user (each person's Notification
 * preference), so nothing else is seeded here. Persists the change and
 * invalidates the config cache. Best-effort, never throws.
 */
export async function autoEnableRemindersFromImages(): Promise<void> {
  if (!AppDataSource.isInitialized) return
  const settingRepo = AppDataSource.getRepository(PageSetting)
  const pageRepo = AppDataSource.getRepository(Page)
  const imgRepo = AppDataSource.getRepository(PageImage)

  const settings = await settingRepo.find()
  let enabled = 0
  for (const s of settings) {
    try {
      const config = JSON.parse(s.config) as SiteConfig
      const w = config.welcome
      if (!w) continue

      // No date yet → OCR the welcome image (DB-stored images only: img:<key>).
      if (!w.expiresAt && typeof w.image === 'string' && w.image.startsWith('img:')) {
        const img = await imgRepo.findOneBy({ pageId: s.pageId, key: w.image.slice(4) })
        if (img) {
          const date = await detectWelcomeExpiry(Buffer.from(img.base64, 'base64'))
          if (date) {
            w.expiresAt = toLocalDateStr(date)
            await settingRepo.update(
              { pageId: s.pageId },
              { config: JSON.stringify(config), updatedAt: new Date() },
            )
            const page = await pageRepo.findOneBy({ id: s.pageId })
            if (page) invalidatePageConfig(page.slug)
            enabled++
            console.log(
              `[reminders] auto-detected · page=${page?.slug ?? s.pageId} expiresAt=${w.expiresAt}`,
            )
          }
        }
      }
    } catch (e) {
      console.error(`[reminders] auto-detect failed for page ${s.pageId}:`, e)
    }
  }
  if (settings.length)
    console.log(`[reminders] startup scan done · ${enabled}/${settings.length} page(s) dated`)
}

// ---------------------------------------------------------------------------
// Part B — scheduler tick
// ---------------------------------------------------------------------------

/**
 * One scheduler tick. Schedules are per-user: for each page with an expiry date,
 * every recipient (owner + active members) is reminded on their own resolved
 * schedule (slots + time-of-day) in their own timezone. Targets are computed
 * per-user-per-slot and deduped by `(pageId, userId, expiresAt, kind)` — the
 * `PageReminderSent` row is claimed BEFORE sending so overlapping ticks and
 * multi-instance deploys can't double-send. Six batched queries per tick (no
 * N+1). Best-effort, never throws.
 */
export async function sendDueReminders(): Promise<void> {
  if (!AppDataSource.isInitialized) return
  const settingRepo = AppDataSource.getRepository(PageSetting)
  const pageRepo = AppDataSource.getRepository(Page)
  const memberRepo = AppDataSource.getRepository(PageMember)
  const userRepo = AppDataSource.getRepository(User)
  const prefRepo = AppDataSource.getRepository(UserPageNotificationPref)
  const sentRepo = AppDataSource.getRepository(PageReminderSent)

  const cfg = await getMailConfig()
  if (!cfg) return // mail not configured yet — retry on a later tick
  const base = await getSiteOrigin()
  const now = Date.now()
  const serverTz = resolveServerTz()

  // A. Enumerate candidate pages (those with an expiry date), reading the raw
  //    settings JSON directly (bypassing the 60s config cache). Schedules are
  //    per-user, so there is no page-level schedule to skim past — the per-user
  //    window check inside the loop below is authoritative.
  const settings = await settingRepo.find()
  const candidates: {
    pageId: number
    expiresAt: string
    config: SiteConfig
  }[] = []
  for (const s of settings) {
    try {
      const config = JSON.parse(s.config) as SiteConfig
      const expiresAt = config.welcome?.expiresAt
      if (!expiresAt) continue
      candidates.push({ pageId: s.pageId, expiresAt, config })
    } catch (e) {
      console.error(`[reminders] skipping page ${s.pageId} (bad config):`, e)
    }
  }
  if (!candidates.length) return

  // B–C. Batch-load candidate pages + their active members.
  const pageIds = candidates.map((c) => c.pageId)
  const pages = await pageRepo.find({ where: { id: In(pageIds) } })
  const pageById = new Map(pages.map((o) => [o.id, o]))
  const members = await memberRepo.find({ where: { pageId: In(pageIds), status: 'active' } })

  // D. Recipient userId set per page = owner ∪ active members (the Set dedupes
  //    the impossible owner-also-member case; pending invites have userId null).
  const usersPerPage = new Map<number, Set<number>>()
  for (const c of candidates) {
    const page = pageById.get(c.pageId)
    if (page) usersPerPage.set(c.pageId, new Set<number>([page.ownerId]))
  }
  for (const m of members) {
    if (m.userId == null) continue
    usersPerPage.get(m.pageId)?.add(m.userId)
  }

  // E. Batch-load every recipient User in one query.
  const allUserIds = new Set<number>()
  for (const set of usersPerPage.values()) for (const uid of set) allUserIds.add(uid)
  const users = allUserIds.size ? await userRepo.find({ where: { id: In([...allUserIds]) } }) : []
  const userById = new Map(users.map((u) => [u.id, u]))

  // F. Batch-load all per-page overrides for candidate pages.
  const prefRows = await prefRepo.find({ where: { pageId: In(pageIds) } })
  const prefByPageUser = new Map<string, UserPageNotificationPref>()
  for (const p of prefRows) prefByPageUser.set(`${p.pageId}:${p.userId}`, p)

  // G. Batch-load relevant sent rows for a dedupe pre-check.
  const distinctExpiry = [...new Set(candidates.map((c) => c.expiresAt))]
  const sentRows = await sentRepo.find({
    where: { pageId: In(pageIds), expiresAt: In(distinctExpiry) },
  })
  const sentKeys = new Set<string>()
  for (const r of sentRows) {
    if (r.userId == null) continue // legacy row (table truncated at cutover)
    sentKeys.add(`${r.pageId}:${r.userId}:${r.expiresAt}:${r.kind}`)
  }

  // H. Per-page → per-user → per-slot send loop.
  for (const c of candidates) {
    const page = pageById.get(c.pageId)
    const userIds = usersPerPage.get(c.pageId)
    if (!page || !userIds || !userIds.size) continue

    for (const uid of userIds) {
      const user = userById.get(uid)
      if (!user) continue
      const pref = resolveEffectivePref({
        user: {
          notifyExpiry: user.notifyExpiry,
          reminderSlots: user.reminderSlots,
          reminderTime: user.reminderTime,
          tz: user.tz,
        },
        pageOverride: prefByPageUser.get(`${c.pageId}:${uid}`) ?? null,
        serverTz,
      })
      if (!pref.enabled || pref.slots.length === 0) continue

      const locale: Locale = user.locale === 'en' ? 'en' : 'zh'

      for (const slot of pref.slots) {
        const target = reminderTarget(c.expiresAt, slot, pref.time, pref.tz) // per-user tz/time
        if (now < target || now >= target + SEND_WINDOW_MS) continue // not yet / too late

        const dedupeKey = `${c.pageId}:${uid}:${c.expiresAt}:${slot}`
        if (sentKeys.has(dedupeKey)) continue

        // Claim the dedupe row first → race-safe across ticks / instances.
        try {
          await sentRepo.insert({
            pageId: c.pageId,
            userId: uid,
            expiresAt: c.expiresAt,
            kind: slot,
          })
        } catch {
          continue // another tick already owns this send
        }
        sentKeys.add(dedupeKey)

        const { subject, html } = reminderEmail(
          c.config,
          locale,
          slot,
          page.name,
          c.expiresAt,
          page.slug,
          base,
        )
        try {
          await sendMailWithConfig(cfg, { to: user.email, subject, body: html, html: true })
        } catch (e) {
          // Row already claimed → this slot won't retry. Acceptable for a nudge.
          console.error(`[reminders] send failed · page=${page.slug} user=${uid} slot=${slot}:`, e)
        }
      }
    }
  }
}
