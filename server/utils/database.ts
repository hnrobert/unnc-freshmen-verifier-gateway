import 'reflect-metadata'
import 'better-sqlite3'
import { DataSource } from 'typeorm'
import type { Logger } from 'typeorm'
import Database from 'better-sqlite3'
import * as entities from '../entities'
import { migrations, BASELINE_MIGRATION } from '../migrations'

const dbPath = process.env.DB_PATH || './data/app.db'

class StartupLogger implements Logger {
  logQuery(): void {}
  logQueryError(error: string | Error, query: string): void {
    console.error(`[db] query error: ${error}\n  ${query}`)
  }
  logQuerySlow(): void {}
  logSchemaBuild(message: string): void {
    console.log(`[db] schema · ${message}`)
  }
  logMigration(message: string): void {
    console.log(`[db] migration · ${message}`)
  }
  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') console.warn(`[db] ${message}`)
    else console.log(`[db] ${message}`)
  }
}

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: Object.values(entities),
  migrations,
  // Schema changes go through migrations ONLY (see server/migrations/). The old
  // `synchronize: true` mode treated renames as drop+create and is what forced
  // this project off migrations once — it must stay off.
  synchronize: false,
  logging: ['error', 'warn'],
  logger: new StartupLogger(),
})

/**
 * Journal fix-ups that must happen BEFORE TypeORM opens the schema, using raw
 * better-sqlite3 (TypeORM is not initialized yet):
 *
 *  1. **Stale legacy journal** — the abandoned pre-`synchronize` migration
 *     system left a `migrations` table whose rows point at files that no longer
 *     exist. TypeORM's journal has the same default name, so it must be dropped
 *     or the runner would think old migrations are applied. Detected by the
 *     legacy system's known first row.
 *  2. **Baseline existing databases** — a database that already has the full v1
 *     schema (detected via the `organizations` table) gets the Init migration
 *     marked as applied, so the runner skips it and applies only what came
 *     after (the org→page rename). Fresh databases start with an empty journal
 *     and receive the full Init.
 */
const LEGACY_JOURNAL_FIRST_ROW = 'Init1784089805639'

function tableExists(raw: Database.Database, name: string): boolean {
  return (
    raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) != null
  )
}

function bootstrapMigrationJournal(): void {
  const raw = new Database(dbPath)
  try {
    if (tableExists(raw, 'migrations')) {
      const rows = raw.prepare('SELECT name FROM migrations').all() as { name: string }[]
      if (!rows.some((r) => r.name === LEGACY_JOURNAL_FIRST_ROW)) return // our journal — TypeORM owns it
      raw.exec('DROP TABLE migrations')
      console.log('[db] dropped stale legacy migrations journal (pre-synchronize era)')
    }

    if (!tableExists(raw, 'organizations')) return // fresh database — full Init will run

    // Existing v1 database: create the journal and mark Init as applied. The
    // DDL mirrors exactly what TypeORM creates for its sqlite journal.
    raw.exec(
      'CREATE TABLE IF NOT EXISTS migrations (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        'timestamp INTEGER NOT NULL, ' +
        'name VARCHAR(255) NOT NULL)',
    )
    raw
      .prepare('INSERT INTO migrations (timestamp, name) VALUES (?, ?)')
      .run(BASELINE_MIGRATION.timestamp, BASELINE_MIGRATION.name)
    console.log(`[db] baselined existing v1 schema · ${BASELINE_MIGRATION.name} marked as applied`)
  } finally {
    raw.close()
  }
}

async function sqliteTables(): Promise<string[]> {
  const rows = (await AppDataSource.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  )) as { name: string }[]
  return rows.map((r) => r.name)
}

export async function initDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) return
  bootstrapMigrationJournal()
  await AppDataSource.initialize()
  // Auto-apply pending migrations on every boot (dev and prod alike) — this is
  // what lets `pnpm migration:generate` output take effect on the next start.
  if (await AppDataSource.showMigrations()) {
    const applied = await AppDataSource.runMigrations({ transaction: 'each' })
    for (const m of applied) console.log(`[db] migration applied · ${m.name}`)
  }
  const tables = await sqliteTables()
  console.log(`[db] ready · ${dbPath} · ${tables.length} table(s)`)
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
