import { type MigrationInterface, type QueryRunner } from 'typeorm'

/**
 * Rebuild page_daily_stats from the raw page_events log.
 *
 * Why: between the org→page rename deploy (2026-08-17) and its fix, the
 * rollup upsert in server/utils/stats.ts still addressed the OLD table/column
 * names (`org_daily_stats (org_id, …)`), so every view/verify increment threw
 * (silently — analytics is fire-and-forget). Raw events kept flowing into
 * page_events via the entity layer the whole time, so the lost rollup rows can
 * be recomputed exactly.
 *
 * For every (page_id, day) present in events, this recomputes each metric with
 * the same definitions as recordView/recordVerify and OVERWRITES the rollup
 * value — events are the source of truth within the 90-day retention window;
 * older rollup days (events already pruned) are left untouched. Idempotent by
 * construction (pure recompute). `down()` is a no-op — there is no meaningful
 * previous state to restore.
 */
export class BackfillDailyStatsFromEvents1760000011000 implements MigrationInterface {
  name = 'BackfillDailyStatsFromEvents1760000011000'

  public async up(qr: QueryRunner): Promise<void> {
    // One row per (page_id, day, metric); NULL metric rows are skipped by the
    // metrics' WHERE clauses below.
    await qr.query(`
      INSERT INTO page_daily_stats (page_id, day, metric, count)
      WITH days AS (
        SELECT page_id, DATE(created_at) AS day FROM page_events
      ),
      agg AS (
        SELECT d.page_id, d.day, 'view' AS metric,
               (SELECT COUNT(*) FROM page_events e
                 WHERE e.page_id = d.page_id AND DATE(e.created_at) = d.day AND e.type = 'view') AS count
        FROM (SELECT DISTINCT page_id, DATE(created_at) AS day FROM page_events WHERE type = 'view') d
        UNION ALL
        SELECT d.page_id, d.day, 'verify_total',
               (SELECT COUNT(*) FROM page_events e
                 WHERE e.page_id = d.page_id AND DATE(e.created_at) = d.day AND e.type = 'verify')
        FROM (SELECT DISTINCT page_id, DATE(created_at) AS day FROM page_events WHERE type = 'verify') d
        UNION ALL
        SELECT d.page_id, d.day, 'verify_' || d.outcome,
               (SELECT COUNT(*) FROM page_events e
                 WHERE e.page_id = d.page_id AND DATE(e.created_at) = d.day AND e.type = 'verify' AND e.outcome = d.outcome)
        FROM (SELECT DISTINCT page_id, DATE(created_at) AS day, outcome FROM page_events WHERE type = 'verify' AND outcome IS NOT NULL) d
        UNION ALL
        SELECT d.page_id, d.day, d.mode,
               (SELECT COUNT(*) FROM page_events e
                 WHERE e.page_id = d.page_id AND DATE(e.created_at) = d.day AND e.type = 'verify' AND e.mode = d.mode)
        FROM (SELECT DISTINCT page_id, DATE(created_at) AS day, mode FROM page_events WHERE type = 'verify' AND mode IS NOT NULL) d
      )
      SELECT page_id, day, metric, count FROM agg WHERE count > 0
      ON CONFLICT (page_id, day, metric) DO UPDATE SET count = excluded.count
    `)
    const rows = (await qr.query('SELECT COUNT(*) AS n FROM page_daily_stats')) as { n: number }[]
    console.log(`[db] backfill · page_daily_stats now has ${rows[0]?.n ?? '?'} rows`)
  }

  public async down(): Promise<void> {
    // No-op — see class doc.
  }
}
