import 'reflect-metadata'
import 'better-sqlite3'
import { DataSource } from 'typeorm'
import type { Logger } from 'typeorm'
import { User } from '#server/entities/user.entity'
import { Session } from '#server/entities/session.entity'
import { Organization } from '#server/entities/organization.entity'
import { OrgSetting } from '#server/entities/orgSetting.entity'
import { OrgImage } from '#server/entities/orgImage.entity'
import { Passkey } from '#server/entities/passkey.entity'
import { Verification } from '#server/entities/verification.entity'
import { AppSetting } from '#server/entities/appSetting.entity'
import { OrgMember } from '#server/entities/orgMember.entity'
import { OrgEvent } from '#server/entities/orgEvent.entity'
import { OrgDailyStat } from '#server/entities/orgDailyStat.entity'

const dbPath = process.env.DB_PATH || './data/app.db'

/**
 * Quiet TypeORM logger for startup: surfaces schema-build DDL (what
 * synchronize() runs) and migration activity with a `[db]` prefix, while
 * suppressing the noisy per-query log. Errors/warns still go through.
 */
class StartupLogger implements Logger {
  logQuery(): void {
    // suppressed — routine SELECT/INSERT etc. would flood startup logs
  }
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
  entities: [
    User,
    Session,
    Organization,
    OrgSetting,
    OrgImage,
    Verification,
    AppSetting,
    Passkey,
    OrgMember,
    OrgEvent,
    OrgDailyStat,
  ],
  // synchronize stays false in config; initDataSource() calls synchronize()
  // explicitly (additive — creates missing tables/columns, never drops data).
  // Migrations are owned by the CLI (tsx); the runtime uses synchronize because
  // the migrations glob doesn't resolve in Nitro's bundled context.
  synchronize: false,
  logging: ['schema', 'migration', 'error', 'warn'],
  logger: new StartupLogger(),
})

/** User-table names in sqlite_master (excludes internal sqlite/LiteFS tables). */
async function sqliteTables(): Promise<string[]> {
  const rows = (await AppDataSource.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  )) as { name: string }[]
  return rows.map((r) => r.name)
}

/** Log how many migrations are recorded as applied (if a migrations table exists). */
async function logMigrationStatus(): Promise<void> {
  const table = (await AppDataSource.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
  )) as { name: string }[]
  if (!table.length) {
    console.log('[db] migrations · none applied (schema managed by synchronize; CLI: pnpm db:run)')
    return
  }
  const rows = (await AppDataSource.query(
    'SELECT timestamp, name FROM migrations ORDER BY timestamp',
  )) as { timestamp: number; name: string }[]
  console.log(`[db] migrations · ${rows.length} applied`)
  for (const r of rows) console.log(`[db]   · ${r.name}`)
}

export async function initDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) return
  await AppDataSource.initialize()
  const before = await sqliteTables()
  // synchronize() logs each CREATE/ALTER via StartupLogger above.
  await AppDataSource.synchronize()
  const after = await sqliteTables()
  const created = after.filter((t) => !before.includes(t))
  if (created.length) console.log(`[db] created ${created.length} table(s): ${created.join(', ')}`)
  else console.log('[db] schema · already in sync (no changes)')
  await logMigrationStatus()
  console.log(`[db] ready · ${dbPath} · ${after.length} table(s)`)
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
