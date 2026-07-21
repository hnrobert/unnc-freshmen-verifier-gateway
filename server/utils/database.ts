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
import { MailConfig } from '#server/entities/mailConfig.entity'

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
  logMigration(): void {}
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
    MailConfig,
  ],
  synchronize: true,
  logging: ['schema', 'error', 'warn'],
  logger: new StartupLogger(),
})

async function sqliteTables(): Promise<string[]> {
  const rows = (await AppDataSource.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  )) as { name: string }[]
  return rows.map((r) => r.name)
}

export async function initDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) return
  await AppDataSource.initialize()
  const tables = await sqliteTables()
  console.log(`[db] ready · ${dbPath} · ${tables.length} table(s)`)
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
