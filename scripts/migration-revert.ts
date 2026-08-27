/**
 * Revert the LAST applied migration (one step).
 *
 *   node --import ./scripts/lib/ts-loader.mjs scripts/migration-revert.ts [--db=<path>]
 *
 * Destructive by definition — back up the database first. Each migration's
 * down() is wrapped in its own transaction.
 */
function resolveDb(): string {
  const arg = process.argv.find((a) => a.startsWith('--db='))
  if (arg) return arg.slice(5)
  return process.env.DB_PATH || './data/app.db'
}

const db = resolveDb()
process.env.DB_PATH = db

const { AppDataSource } = await import('../server/utils/database')

try {
  await AppDataSource.initialize()
  const before = (
    (await AppDataSource.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')) as {
      name: string
    }[]
  )[0]?.name
  await AppDataSource.undoLastMigration({ transaction: 'each' })
  const after = (
    (await AppDataSource.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')) as {
      name: string
    }[]
  )[0]?.name
  console.log(
    `[migration:revert] reverted · ${before ?? '(none)'} → now at ${after ?? '(empty)'} · ${db}`,
  )
} finally {
  if (AppDataSource.isInitialized) await AppDataSource.destroy()
}
