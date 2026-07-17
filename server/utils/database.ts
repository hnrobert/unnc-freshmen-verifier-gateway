import 'reflect-metadata'
import 'better-sqlite3'
import { DataSource } from 'typeorm'
import { User } from '../entities/user.entity'
import { Session } from '../entities/session.entity'
import { Organization } from '../entities/organization.entity'
import { OrgSetting } from '../entities/orgSetting.entity'
import { OrgImage } from '../entities/orgImage.entity'
import { Verification } from '../entities/verification.entity'

const dbPath = process.env.DB_PATH || './data/app.db'

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [User, Session, Organization, OrgSetting, OrgImage, Verification],
  // synchronize stays false: the CLI migration scripts (tsx) own prod migrations.
  // At runtime (Nitro) we call synchronize() explicitly in initDataSource() because
  // the migrations glob doesn't resolve in Nitro's bundled context.
  synchronize: false,
})

export async function initDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
    // synchronize() is additive — creates missing tables/columns from entities,
    // doesn't drop data. Ensures the schema is always in sync on boot.
    await AppDataSource.synchronize()
    console.log('[db] DataSource initialized (schema synced)')
  }
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
