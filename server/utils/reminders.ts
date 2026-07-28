/**
 * QR-expiry reminder system: two halves that together make
 * `config.welcome.{expiresAt, reminderEnabled}` actually do something.
 *
 *  • {@link autoEnableRemindersFromImages} — runs once at startup: OCR-scans each
 *    org's welcome image for an expiry date and, when one is found, fills
 *    `expiresAt` and turns on `reminderEnabled` (auto-creating the schedule).
 *  • {@link sendDueReminders} — the scheduler tick (every few minutes): for each
 *    scheduled org, fires a `day-before` (noon) and `day-of` (08:00) reminder
 *    email to opted-in members, recording each send in `OrgReminderSent` so it
 *    never repeats (the table's unique constraint also makes it race-safe across
 *    instances).
 *
 * All server-local time, matching `qrExpiry.ts`. Everything is best-effort:
 * OCR failures, missing mail config, or no opted-in recipients degrade to a
 * silent no-op rather than crashing the scheduler.
 */
import { AppDataSource } from './database'
import { Organization } from '#server/entities/organization.entity'
import { OrgSetting } from '#server/entities/orgSetting.entity'
import { OrgImage } from '#server/entities/orgImage.entity'
import { OrgMember } from '#server/entities/orgMember.entity'
import { OrgReminderSent, type ReminderKind } from '#server/entities/orgReminderSent.entity'
import { User } from '#server/entities/user.entity'
import type { Locale, SiteConfig } from '#shared/types'
import { detectWelcomeExpiry } from './ocr'
import { toLocalDateStr } from './qrExpiry'
import { invalidateOrgConfig } from './orgs'
import { renderEmail } from '#server/mail/render'
import { getMailConfig, sendMailWithConfig } from './mail'
import { getSiteOrigin } from './siteOrigin'

/** How often the scheduler wakes to check for due reminders. */
export const REMINDER_TICK_MS = 5 * 60 * 1000
/** A reminder fires once within [target, target + WINDOW) — lenient so a few
 * hours of downtime don't cause a miss, bounded so a fresh deploy doesn't emit
 * a burst of long-stale reminders. */
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000
/** Send times (server-local), matching the OrgReminderSent entity doc. */
const DAY_BEFORE_HOUR = 12 // noon the day before expiry
const DAY_OF_HOUR = 8 // 08:00 on expiry day

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

/** Absolute (or relative, if no origin known) URL to an org's public page. */
function orgUrl(slug: string, base: string): string {
  return `${base}/${slug}`
}

/** The instant a given reminder kind should fire, in server-local time. */
function reminderTarget(expiresAt: string, kind: ReminderKind): Date {
  const parts = expiresAt.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = (parts[1] ?? 1) - 1
  const d = parts[2] ?? 1
  return kind === 'day-before'
    ? new Date(y, m, d - 1, DAY_BEFORE_HOUR, 0, 0, 0) // d-1 rolls back across month boundary
    : new Date(y, m, d, DAY_OF_HOUR, 0, 0, 0)
}

/** Opted-in reminder recipients for an org: active members + the owner, each with
 * their preferred locale (falling back to zh). Deduped by email. */
async function reminderRecipients(
  orgId: number,
  ownerId: number,
): Promise<{ email: string; locale: Locale }[]> {
  const memberRepo = AppDataSource.getRepository(OrgMember)
  const userRepo = AppDataSource.getRepository(User)
  const members = await memberRepo.find({ where: { orgId, status: 'active' } })
  const ids = new Set<number>([ownerId])
  for (const mem of members) if (mem.userId != null) ids.add(mem.userId)
  if (!ids.size) return []
  const users = await userRepo.find({ where: [...ids].map((id) => ({ id })) })
  const byEmail = new Map<string, Locale>()
  for (const u of users) {
    if (!u.notifyExpiry) continue
    const locale: Locale = u.locale === 'en' ? 'en' : 'zh'
    byEmail.set(u.email, locale)
  }
  return [...byEmail.entries()].map(([email, locale]) => ({ email, locale }))
}

/** Build the localized reminder email (subject + themed HTML) for one recipient. */
function reminderEmail(
  locale: Locale,
  kind: ReminderKind,
  orgName: string,
  expiresAt: string,
  slug: string,
  base: string,
): { subject: string; html: string } {
  const isZh = locale === 'zh'
  const dateStr = formatExpiryDate(expiresAt, locale)
  const title =
    kind === 'day-before'
      ? isZh
        ? '你的二维码明天过期'
        : 'Your QR code expires tomorrow'
      : isZh
        ? '你的二维码今天过期'
        : 'Your QR code expires today'
  const bodyHtml = isZh
    ? `<p>组织 <strong>${escapeHtml(orgName)}</strong> 欢迎页的二维码将于 <strong>${dateStr}</strong> 过期。请尽快更换最新的二维码图片，以免新生扫码失效。</p>`
    : `<p>The welcome-page QR code for <strong>${escapeHtml(orgName)}</strong> expires on <strong>${dateStr}</strong>. Please refresh it soon so new students can still scan it.</p>`
  const html = renderEmail({
    title,
    bodyHtml,
    actionLabel: isZh ? '查看组织' : 'View organization',
    actionUrl: orgUrl(slug, base),
    preheader: title,
  })
  return { subject: `${orgName} · ${title}`, html }
}

// ---------------------------------------------------------------------------
// Part A — startup auto-detect + enable
// ---------------------------------------------------------------------------

/**
 * For every org, if no expiry schedule is active yet, try to read one from the
 * welcome image via OCR. On success: set `welcome.expiresAt` (only when empty —
 * a manual date is never overwritten) and turn on `welcome.reminderEnabled`.
 * Persists the change and invalidates the config cache. Best-effort, never throws.
 */
export async function autoEnableRemindersFromImages(): Promise<void> {
  if (!AppDataSource.isInitialized) return
  const settingRepo = AppDataSource.getRepository(OrgSetting)
  const orgRepo = AppDataSource.getRepository(Organization)
  const imgRepo = AppDataSource.getRepository(OrgImage)

  const settings = await settingRepo.find()
  let enabled = 0
  for (const s of settings) {
    try {
      const config = JSON.parse(s.config) as SiteConfig
      const w = config.welcome
      if (!w) continue
      let changed = false

      // Activate an existing manually-set date that isn't scheduled yet.
      if (w.expiresAt && !w.reminderEnabled) {
        w.reminderEnabled = true
        changed = true
      }

      // No date yet → OCR the welcome image (DB-stored images only: img:<key>).
      if (!w.expiresAt && typeof w.image === 'string' && w.image.startsWith('img:')) {
        const img = await imgRepo.findOneBy({ orgId: s.orgId, key: w.image.slice(4) })
        if (img) {
          const date = await detectWelcomeExpiry(Buffer.from(img.base64, 'base64'))
          if (date) {
            w.expiresAt = toLocalDateStr(date)
            w.reminderEnabled = true
            changed = true
          }
        }
      }

      if (!changed) continue
      await settingRepo.update(
        { orgId: s.orgId },
        { config: JSON.stringify(config), updatedAt: new Date() },
      )
      const org = await orgRepo.findOneBy({ id: s.orgId })
      if (org) invalidateOrgConfig(org.slug)
      enabled++
      console.log(`[reminders] auto-enabled · org=${org?.slug ?? s.orgId} expiresAt=${w.expiresAt}`)
    } catch (e) {
      console.error(`[reminders] auto-enable failed for org ${s.orgId}:`, e)
    }
  }
  if (settings.length)
    console.log(`[reminders] startup scan done · ${enabled}/${settings.length} org(s) enabled`)
}

// ---------------------------------------------------------------------------
// Part B — scheduler tick
// ---------------------------------------------------------------------------

/**
 * One scheduler tick: for each org with reminders on + an expiry date, fire any
 * due `day-before` / `day-of` reminders (within the send window) to opted-in
 * recipients, recording each in `OrgReminderSent`. Best-effort, never throws.
 */
export async function sendDueReminders(): Promise<void> {
  if (!AppDataSource.isInitialized) return
  const settingRepo = AppDataSource.getRepository(OrgSetting)
  const orgRepo = AppDataSource.getRepository(Organization)
  const sentRepo = AppDataSource.getRepository(OrgReminderSent)

  const cfg = await getMailConfig()
  if (!cfg) return // mail not configured yet — retry on a later tick

  // Canonical public origin for email links, inferred from observed traffic.
  const base = await getSiteOrigin()
  const now = Date.now()
  const settings = await settingRepo.find()
  for (const s of settings) {
    try {
      const config = JSON.parse(s.config) as SiteConfig
      const expiresAt = config.welcome?.expiresAt
      if (!config.welcome?.reminderEnabled || !expiresAt) continue

      const org = await orgRepo.findOneBy({ id: s.orgId })
      if (!org) continue

      for (const kind of ['day-before', 'day-of'] as ReminderKind[]) {
        const target = reminderTarget(expiresAt, kind).getTime()
        if (now < target || now >= target + SEND_WINDOW_MS) continue // not yet / too late

        // Idempotency: skip if already sent for this org/date/kind.
        if (await sentRepo.findOneBy({ orgId: org.id, expiresAt, kind })) continue

        const recipients = await reminderRecipients(org.id, org.ownerId)
        for (const r of recipients) {
          const { subject, html } = reminderEmail(
            r.locale,
            kind,
            org.name,
            expiresAt,
            org.slug,
            base,
          )
          try {
            await sendMailWithConfig(cfg, { to: r.email, subject, body: html, html: true })
          } catch (e) {
            console.error(`[reminders] send failed · org=${org.slug} to=${r.email}:`, e)
          }
        }

        // Record the send (unique constraint → safe under races / multi-instance).
        try {
          await sentRepo.insert({ orgId: org.id, expiresAt, kind })
        } catch {
          // already inserted concurrently — fine
        }
      }
    } catch (e) {
      console.error(`[reminders] tick failed for org ${s.orgId}:`, e)
    }
  }
}
