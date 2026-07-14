import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** Users — email/password accounts (open self-registration). */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Sessions — revocable server-side sessions (the cookie carries the id). */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Organizations — each owned by a user, addressed by a unique slug. */
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Per-org SiteConfig (JSON). Images live in org_images and are referenced by `img:<key>`. */
export const orgSettings = sqliteTable('org_settings', {
  orgId: text('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  config: text('config').notNull(),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Per-org images stored as base64 (TEXT), keyed by name within the org. */
export const orgImages = sqliteTable(
  'org_images',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    mime: text('mime').notNull(),
    base64: text('base64').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    orgKeyUniq: uniqueIndex('org_images_org_key_uniq').on(t.orgId, t.key),
  }),
)
