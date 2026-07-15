import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..', '..')

const dbPath = process.env.DB_PATH || './data/app.db'

execSync(
  'tsx --tsconfig server/tsconfig.json ./node_modules/typeorm/cli.js -d server/utils/database.ts migration:run',
  {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, DB_PATH: dbPath, TYPEORM_MIGRATION: 'true' },
  },
)
