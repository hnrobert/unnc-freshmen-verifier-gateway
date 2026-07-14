/**
 * Seed a demo user + org so the app is usable immediately.
 *   pnpm db:seed   (email: demo@example.com  password: demo1234  org slug: demo)
 */
import { eq } from 'drizzle-orm'
import { createDB } from '../utils/db'
import { hashPassword } from '../utils/auth'
import { organizations, orgSettings, users } from './schema'
import defaultConfig from '../../shared/lib/defaultConfig'
import type { SiteConfig } from '../../shared/types'

const dbPath = process.env.DB_PATH || './data/app.db'
const { db } = createDB(dbPath)

const email = 'demo@example.com'
const password = 'demo1234'
const slug = 'demo'
const orgName = 'Demo Org'

const existingUser = db.select().from(users).where(eq(users.email, email)).all()
const userId = existingUser[0]?.id ?? crypto.randomUUID()
if (!existingUser.length) {
  db.insert(users).values({ id: userId, email, passwordHash: hashPassword(password) }).run()
  console.log(`created user ${email} (password: ${password})`)
} else {
  console.log(`user ${email} already exists`)
}

const existingOrg = db.select().from(organizations).where(eq(organizations.slug, slug)).all()
const orgId = existingOrg[0]?.id ?? crypto.randomUUID()
if (!existingOrg.length) {
  db.insert(organizations).values({ id: orgId, ownerId: userId, slug, name: orgName }).run()
  console.log(`created org "${slug}"`)
} else {
  console.log(`org "${slug}" already exists`)
}

// Seed config = defaultConfig with the brand title set to the org name.
const cfg = structuredClone(defaultConfig) as SiteConfig
const zh = cfg.messages.zh as { brand: { title: string } }
const en = cfg.messages.en as { brand: { title: string } }
zh.brand.title = orgName
en.brand.title = orgName
db.insert(orgSettings)
  .values({ orgId, config: JSON.stringify(cfg) })
  .onConflictDoUpdate({ target: orgSettings.orgId, set: { config: JSON.stringify(cfg) } })
  .run()
console.log(`seeded org_settings for "${slug}"`)
console.log('done.')
