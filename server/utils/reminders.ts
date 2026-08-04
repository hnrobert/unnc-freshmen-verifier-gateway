/**
 * QR-expiry reminder system: two halves that together make
 * `config.welcome.{expiresAt, reminders}` actually do something.
 *
 *  • {@link autoEnableRemindersFromImages} — runs once at startup: OCR-scans each
 *    org's welcome image for an expiry date and, when one is found, fills
 *    `expiresAt` and seeds a default `reminders` set (auto-creating the schedule).
 *  • {@link sendDueReminders} — the scheduler tick (every few minutes): for each
 *    scheduled org, fires each enabled reminder slot (`-3d`/`-2d`/`-1d`/`day-of`,
 *    all at 12:00 server-local on their day) to opted-in members, recording each
 *    send in `OrgReminderSent` so it never repeats (the table's unique constraint
 *    also makes it race-safe across instances).
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
import { OrgReminderSent } from '#server/entities/orgReminderSent.entity'
import { User } from '#server/entities/user.entity'
import { REMINDER_SLOTS, type Locale, type ReminderSlot, type SiteConfig } from '#shared/types'
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
/** Default slots enabled by the startup auto-detect (owner can widen in the UI). */
const DEFAULT_SLOTS: ReminderSlot[] = ['-1d', 'day-of']
/** Default time-of-day (server-local, HH:MM) when `welcome.reminderTime` is unset. */
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

/** Absolute URL to the org's edit page (so the recipient can refresh the QR). */
function orgUrl(slug: string, base: string): string {
  return `${base}/dashboard/${slug}/edit`
}

/** Resolve the configured reminder slots, falling back to the legacy
 * `reminderEnabled` flag for old config rows that predate the `reminders` array. */
function effectiveReminders(w: SiteConfig['welcome']): ReminderSlot[] {
  const valid = new Set<ReminderSlot>(REMINDER_SLOTS)
  const slots = (w?.reminders ?? []).filter((s): s is ReminderSlot => valid.has(s))
  if (slots.length) return slots
  return w?.reminderEnabled ? DEFAULT_SLOTS : []
}

/** The instant a given reminder slot should fire — at `reminderTime` (HH:MM,
 * server-local, default noon) on its day. `-Nd` → N days before `expiresAt`
 * (d-N rolls back across the month boundary); `day-of` → on `expiresAt`. */
function reminderTarget(expiresAt: string, slot: ReminderSlot, reminderTime?: string): Date {
  const parts = expiresAt.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = (parts[1] ?? 1) - 1
  const d = parts[2] ?? 1
  const offset = slot === 'day-of' ? 0 : -Number.parseInt(slot.slice(1), 10)
  const [hh, mm] = (reminderTime || DEFAULT_REMINDER_TIME).split(':').map(Number)
  return new Date(y, m, d + offset, hh ?? 12, mm ?? 0, 0, 0)
}

/** Reminder recipients for an org: the owner ALWAYS (they configured the
 * schedule) plus active members who opted in via `notifyExpiry`, each with their
 * preferred locale (falling back to zh). Deduped by email. */
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
    const isOwner = u.id === ownerId
    if (!isOwner && !u.notifyExpiry) continue // owner always; members opt in
    const locale: Locale = u.locale === 'en' ? 'en' : 'zh'
    byEmail.set(u.email, locale)
  }
  return [...byEmail.entries()].map(([email, locale]) => ({ email, locale }))
}

/** Build the localized reminder email (subject + themed HTML) for one recipient. */
function reminderEmail(
  locale: Locale,
  slot: ReminderSlot,
  orgName: string,
  expiresAt: string,
  slug: string,
  base: string,
): { subject: string; html: string } {
  const isZh = locale === 'zh'
  const dateStr = formatExpiryDate(expiresAt, locale)
  // Slot-specific headline (all slots fire at noon on their day).
  const title = isZh
    ? slot === 'day-of'
      ? '你的二维码今天过期'
      : `你的二维码 ${Number.parseInt(slot.slice(1), 10)} 天后过期`
    : slot === 'day-of'
      ? 'Your QR code expires today'
      : slot === '-1d'
        ? 'Your QR code expires tomorrow'
        : `Your QR code expires in ${Number.parseInt(slot.slice(1), 10)} days`
  const bodyHtml = isZh
    ? `<p>组织 <strong>${escapeHtml(orgName)}</strong> 欢迎页的二维码将于 <strong>${dateStr}</strong> 过期。请尽快更换最新的二维码图片，以免新生扫码失效。</p>`
    : `<p>The welcome-page QR code for <strong>${escapeHtml(orgName)}</strong> expires on <strong>${dateStr}</strong>. Please refresh it soon so new students can still scan it.</p>`
  const html = renderEmail({
    title,
    bodyHtml,
    actionLabel: isZh ? '更换二维码' : 'Update QR code',
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
 * a manual date is never overwritten) and seed `welcome.reminders` with a default
 * set. Persists the change and invalidates the config cache. Best-effort, never throws.
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

      // Activate an existing manually-set date that has no reminder slots yet.
      if (w.expiresAt && effectiveReminders(w).length === 0) {
        w.reminders = DEFAULT_SLOTS
        changed = true
      }

      // No date yet → OCR the welcome image (DB-stored images only: img:<key>).
      if (!w.expiresAt && typeof w.image === 'string' && w.image.startsWith('img:')) {
        const img = await imgRepo.findOneBy({ orgId: s.orgId, key: w.image.slice(4) })
        if (img) {
          const date = await detectWelcomeExpiry(Buffer.from(img.base64, 'base64'))
          if (date) {
            w.expiresAt = toLocalDateStr(date)
            w.reminders = DEFAULT_SLOTS
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
 * One scheduler tick: for each org with reminder slots + an expiry date, fire any
 * due slot (within the send window) to opted-in recipients, recording each in
 * `OrgReminderSent`. Best-effort, never throws.
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
      const slots = expiresAt ? effectiveReminders(config.welcome) : []
      if (!expiresAt || !slots.length) continue

      const org = await orgRepo.findOneBy({ id: s.orgId })
      if (!org) continue

      for (const slot of slots) {
        const target = reminderTarget(expiresAt, slot, config.welcome?.reminderTime).getTime()
        if (now < target || now >= target + SEND_WINDOW_MS) continue // not yet / too late

        // Idempotency: skip if already sent for this org/date/slot.
        if (await sentRepo.findOneBy({ orgId: org.id, expiresAt, kind: slot })) continue

        const recipients = await reminderRecipients(org.id, org.ownerId)
        for (const r of recipients) {
          const { subject, html } = reminderEmail(
            r.locale,
            slot,
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
          await sentRepo.insert({ orgId: org.id, expiresAt, kind: slot })
        } catch {
          // already inserted concurrently — fine
        }
      }
    } catch (e) {
      console.error(`[reminders] tick failed for org ${s.orgId}:`, e)
    }
  }
}
