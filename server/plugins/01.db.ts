import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

// Open the SQLite DB on boot and apply any pending Drizzle migrations.
export default defineNitroPlugin(() => {
  const db = useDB()
  const folder = resolve('./server/db/migrations')
  if (existsSync(folder)) {
    migrate(db, { migrationsFolder: folder })
  } else {
    console.warn('[db] no migrations folder found — run `pnpm db:generate` then `pnpm db:migrate`')
  }
})
