/**
 * Generate a TypeORM migration from entity changes.
 *   pnpm db:generate -- --name=Init
 *
 * Checks for entity changes, prompts for a migration name, runs pending
 * migrations on the comparison DB, then generates the new migration file.
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..', '..')
const migrationsDir = resolve(rootDir, 'server', 'migrations')

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

const hasEntityChanges = (): boolean => {
  const out = execSync('git status --porcelain server/entities', { cwd: rootDir }).toString().trim()
  return out.length > 0
}

const main = async (): Promise<void> => {
  if (!hasEntityChanges()) {
    console.log('No changes in entities detected.')
    const rl = createInterface({ input, output })
    const answer = await rl.question('Continue anyway? (y/N): ')
    rl.close()
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('Cancelled.')
      return
    }
  }

  const { name: cliName } = parseArgs()
  const name = await readMigrationName(cliName)
  const dbPath = process.env.DB_PATH || './data/app.db'
  const env = { ...process.env, DB_PATH: dbPath, TYPEORM_MIGRATION: 'true' }

  const beforeFiles = listMigrationFiles()

  // Bring comparison DB to latest, then generate
  run('pnpm db:run', env)
  run(
    `tsx --tsconfig server/tsconfig.json ./node_modules/typeorm/cli.js -d server/utils/database.ts migration:generate server/migrations/${name}`,
    env,
  )

  const afterFiles = listMigrationFiles()
  const newFiles = afterFiles.filter((f) => !beforeFiles.includes(f))

  if (!newFiles.length) {
    console.error('Expected a new migration file but none was generated.')
    process.exit(1)
  }

  // Prepend eslint-disable (harmless even without ESLint)
  newFiles.forEach((file) => {
    const filePath = resolve(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    if (!content.startsWith('/* eslint-disable')) {
      writeFileSync(filePath, `/* eslint-disable class-methods-use-this */\n${content}`)
    }
  })

  console.log(`Generated: ${newFiles.join(', ')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
