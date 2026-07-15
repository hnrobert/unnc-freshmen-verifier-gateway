import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { User } from '../entities/user.entity'
import { Session } from '../entities/session.entity'
import { Organization } from '../entities/organization.entity'
import { OrgSetting } from '../entities/orgSetting.entity'
import { OrgImage } from '../entities/orgImage.entity'
import { Verification } from '../entities/verification.entity'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbPath = process.env.DB_PATH || './data/app.db'

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [User, Session, Organization, OrgSetting, OrgImage, Verification],
  migrations: [resolve(__dirname, '..', 'migrations', '*.ts')],
  synchronize: false,
})

export async function initDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
    const pending = await AppDataSource.showMigrations()
    if (pending) {
      await AppDataSource.runMigrations()
      console.log('[db] pending migrations applied')
    } else {
      console.log('[db] TypeORM DataSource initialized')
    }
  }
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
