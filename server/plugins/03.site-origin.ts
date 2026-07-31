import { flushOriginTally, startOriginFlushTimer } from '#server/utils/siteOrigin'

/**
 * Boots the origin-tally persistence: loads the accumulated tally from
 * `AppSetting` at startup (so the canonical origin is known before any new
 * request arrives) and flushes updates on a recurring, unref'd timer. A `close`
 * hook flushes once more on graceful shutdown (deploy / `docker stop` / SIGTERM)
 * so clean restarts lose nothing. Runs after `01.db.ts`, so the DataSource is
 * ready. (A hard crash can still lose up to one flush interval of fresh counts —
 * but that never changes which origin is the most common.)
 */
export default defineNitroPlugin((nitroApp) => {
  void flushOriginTally().catch(() => {}) // also triggers the lazy load
  startOriginFlushTimer()
  nitroApp.hooks.hook('close', async () => {
    await flushOriginTally().catch(() => {})
  })
})
