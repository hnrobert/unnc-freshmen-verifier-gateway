import 'reflect-metadata'
import 'better-sqlite3'
import { DataSource } from 'typeorm'
import type { Logger } from 'typeorm'
import { User } from '#server/entities/user.entity'
import { Session } from '#server/entities/session.entity'
import { Page } from '#server/entities/page.entity'
import { PageSetting } from '#server/entities/pageSetting.entity'
import { PageImage } from '#server/entities/pageImage.entity'
import { Passkey } from '#server/entities/passkey.entity'
import { PageVerifiedIdentity } from '#server/entities/pageVerifiedIdentity.entity'
import { AppSetting } from '#server/entities/appSetting.entity'
import { PageMember } from '#server/entities/pageMember.entity'
import { UserPageNotificationPref } from '#server/entities/userPageNotificationPref.entity'
import { PageEvent } from '#server/entities/pageEvent.entity'
import { PageDailyStat } from '#server/entities/pageDailyStat.entity'
import { MailConfig } from '#server/entities/mailConfig.entity'
import { PageReminderSent } from '#server/entities/pageReminderSent.entity'
import { PageRedirect } from '#server/entities/pageRedirect.entity'
import { AuditEvent } from '#server/entities/auditEvent.entity'

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
    Page,
    PageSetting,
    PageImage,
    PageVerifiedIdentity,
    AppSetting,
    Passkey,
    PageMember,
    UserPageNotificationPref,
    PageEvent,
    PageDailyStat,
    MailConfig,
    PageReminderSent,
    PageRedirect,
    AuditEvent,
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
