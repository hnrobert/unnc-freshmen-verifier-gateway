import { type MigrationInterface, type QueryRunner } from 'typeorm'
import { INIT_DDL } from './1760000000000-Init'

/**
 * Bring ANY legacy database up to the entity-declared schema.
 *
 * Why this exists: the journal bootstrap marks Init as applied on databases
 * that have the v1 `organizations` table — but "has v1" does not mean "has
 * every column the entities declare today". Production databases that missed
 * deployments from the `synchronize: true` era can lack columns (e.g.
 * `mail_configs.post_field_map`), whole tables (e.g. `audit_events`) or
 * indexes. This migration closes that gap deterministically:
 *
 *  1. **Replay Init's DDL** — every statement is `CREATE … IF NOT EXISTS`, so
 *     missing tables and indexes are created and existing ones are untouched.
 *  2. **Add missing columns** from the live entity metadata, guarded by
 *     `PRAGMA table_info`. Columns are only ever ADDED — nothing is dropped,
 *     renamed or retyped.
 *
 * On a healthy database both steps are no-ops, so it is safe on fresh Init
 * databases too. Not reversible (there is nothing meaningful to undo: which
 * of the added columns "existed before" is unknown) — `down()` is a no-op.
 */
export class AlignLegacySchema1760000010000 implements MigrationInterface {
  name = 'AlignLegacySchema1760000010000'

  private async columns(qr: QueryRunner, table: string): Promise<Set<string>> {
    const rows = (await qr.query(`PRAGMA table_info(${table})`)) as { name: string }[]
    return new Set(Array.isArray(rows) ? rows.map((r) => r.name) : [])
  }

  /** Render an entity default as SQL, or undefined when there is none. */
  private defaultSql(def: unknown): string | undefined {
    if (def === undefined || def === null) return undefined
    if (typeof def === 'function') {
      const evaluated = String(def())
      return /CURRENT_TIMESTAMP/i.test(evaluated) ? evaluated : `'${evaluated}'`
    }
    if (typeof def === 'number' || typeof def === 'boolean') return String(def)
    return /CURRENT_TIMESTAMP/i.test(String(def)) ? String(def) : `'${def}'`
  }

  /** NOT NULL columns added to a table with existing rows need a value. */
  private fallbackFor(type: string): string {
    if (/int/i.test(type)) return '0'
    if (/bool/i.test(type)) return 'false'
    if (/datetime|timestamp/i.test(type)) return 'CURRENT_TIMESTAMP'
    return "''"
  }

  public async up(qr: QueryRunner): Promise<void> {
    // 1. Missing tables + indexes.
    for (const sql of INIT_DDL) await qr.query(sql)

    // 2. Missing columns (add-only, from the live entity metadata).
    for (const meta of qr.connection.entityMetadatas) {
      const table = meta.tableName
      const existing = await this.columns(qr, table)
      if (existing.size === 0) continue // table just created by step 1 — already complete

      for (const col of meta.columns) {
        if (col.isPrimary) continue // primary keys cannot be ADDed; legacy tables have theirs
        if (existing.has(col.databaseName)) continue

        const type = String(col.type ?? 'text')
        let sql = `ALTER TABLE ${table} ADD COLUMN "${col.databaseName}" ${type}`
        const def =
          this.defaultSql(col.default) ?? (col.isNullable ? undefined : this.fallbackFor(type))
        if (def !== undefined) sql += ` DEFAULT ${def}`
        if (!col.isNullable && def !== undefined) sql += ' NOT NULL'
        await qr.query(sql)
        console.log(`[db] align · added ${table}.${col.databaseName}`)
      }
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty — see the class doc.
  }
}
