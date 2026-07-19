/**
 * Generate a TypeORM migration from entity changes.
 *   pnpm db:generate -- --name=AddMailConfig
 *
 * Generates against a THROWAWAY database built from the *existing migrations*
 * (not the live dev DB, which may already have been mutated). The diff between
 * the entities and that migrations-only baseline is exactly what the new
 * migration must add. The migrations barrel (server/migrations/index.ts) is then
 * regenerated so the DataSource picks the new migration up automatically.
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..', '..')
const migrationsDir = resolve(rootDir, 'server', 'migrations')
const tmpDb = resolve(rootDir, 'data', '.migration-gen.db')

const run = (command: string, env?: NodeJS.ProcessEnv): void => {
  execSync(command, { stdio: 'inherit', cwd: rootDir, env: env ?? process.env })
}

const parseArgs = (): { name?: string } => {
  const args = process.argv.slice(2)
  const result: { name?: string } = {}
  args.forEach((arg, index) => {
    if (arg.startsWith('--name=')) [, result.name] = arg.split('=')
    if (arg === '--name' && args[index + 1]) result.name = args[index + 1]
  })
  return result
}

const readMigrationName = async (cliName?: string): Promise<string> => {
  if (cliName) return cliName
  if (!process.stdin.isTTY) return `Auto${Date.now()}`
  const rl = createInterface({ input, output })
  const answer = await rl.question('Enter migration name: ')
  rl.close()
  return answer.trim() || `Auto${Date.now()}`
}

const listMigrationFiles = (): string[] => {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir).filter((f) => f.endsWith('.ts'))
}

const cleanTmpDb = (): void => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      unlinkSync(tmpDb + suffix)
    } catch {
      /* not present */
    }
  }
}

const main = async (): Promise<void> => {
  const { name: cliName } = parseArgs()
  const name = await readMigrationName(cliName)
  const genEnv = { ...process.env, DB_PATH: tmpDb, TYPEORM_MIGRATION: 'true' }

  // 1. Build a baseline from the existing migrations on a throwaway DB.
  cleanTmpDb()
  run('pnpm db:run', genEnv)

  // 2. Diff entities vs that baseline → new migration. (typeorm errors with
  //    "No changes" if there's nothing to generate, which is the correct signal.)
  const beforeFiles = listMigrationFiles()
  try {
    run(
      `tsx --tsconfig server/tsconfig.json ./node_modules/typeorm/cli.js -d server/utils/database.ts migration:generate server/migrations/${name}`,
      genEnv,
    )
  } finally {
    cleanTmpDb()
  }

  const newFiles = listMigrationFiles().filter((f) => !beforeFiles.includes(f))
  if (!newFiles.length) {
    console.error('Expected a new migration file but none was generated.')
    process.exit(1)
  }

  // 3. Prepend eslint-disable, then regenerate the migrations barrel so the
  //    DataSource imports the new migration automatically (no manual list).
  for (const file of newFiles) {
    const filePath = resolve(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    if (!content.startsWith('/* eslint-disable')) {
      writeFileSync(filePath, `/* eslint-disable class-methods-use-this */\n${content}`)
    }
  }
  run('tsx server/scripts/syncMigrations.ts')

  console.log(`Generated: ${newFiles.join(', ')}`)
  console.log('Commit the new migration + server/migrations/index.ts.')
}

main().catch((e) => {
  cleanTmpDb()
  console.error(e)
  process.exit(1)
})
