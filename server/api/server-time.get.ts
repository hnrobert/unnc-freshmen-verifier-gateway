/** Returns the server's current time and IANA timezone. Used by the org editor's
 * reminder-time picker so the owner can see the server clock the schedule runs
 * against. Public — only exposes the clock. */
export default defineEventHandler(() => {
  const now = new Date()
  return {
    now: now.toISOString(),
    tz: resolveServerTz(),
  }
})
