/**
 * Apply pending migrations to a database.
 *
 *   node --import ./scripts/lib/ts-loader.mjs scripts/migration-run.ts [--db=<path>]
 *
 * Target resolution: --db flag > DB_PATH env > ./data/app.db. Runs the exact
 * same code path as server boot (initDataSource), so what you get locally is
 * what production does automatically on its next start.
 */
function resolveDb(): string {
  const arg = process.argv.find((a) => a.startsWith('--db='))
  if (arg) return arg.slice(5)
  return process.env.DB_PATH || './data/app.db'
}

const db = resolveDb()
process.env.DB_PATH = db

const { initDataSource, closeDataSource } = await import('../server/utils/database')

try {
  await initDataSource()
  console.log(`[migration:run] up to date · ${db}`)
} finally {
  await closeDataSource()
}
