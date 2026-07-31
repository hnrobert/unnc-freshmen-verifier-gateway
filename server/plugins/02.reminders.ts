import {
  REMINDER_TICK_MS,
  autoEnableRemindersFromImages,
  sendDueReminders,
} from '#server/utils/reminders'

/**
 * Boots the QR-expiry reminder system. Runs after `01.db.ts` (Nitro awaits
 * plugins in filename order, so the DataSource is initialized by the time this
 * runs). Two things start here:
 *   1. A one-shot startup scan that OCR-detects expiry dates from org images and
 *      auto-enables the reminder schedule (fire-and-forget — OCR is slow and must
 *      not delay server readiness).
 *   2. A recurring scheduler that sends due reminders every few minutes, with an
 *      initial run shortly after boot so newly-enabled orgs are picked up fast.
 * Both timers are unref'd so they never keep the process alive on shutdown.
 */
export default defineNitroPlugin(() => {
  void autoEnableRemindersFromImages().catch((e) =>
    console.error('[reminders] startup scan error:', e),
  )

  const boot = setTimeout(() => {
    void sendDueReminders().catch(() => {})
  }, 30_000)
  const tick = setInterval(() => {
    void sendDueReminders().catch(() => {})
  }, REMINDER_TICK_MS)

  boot.unref?.()
  tick.unref?.()
})
