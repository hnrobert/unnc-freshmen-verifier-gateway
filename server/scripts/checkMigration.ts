/**
 * Pre-commit guard: entity changes require a new migration.
 *   pnpm db:check  (intended as a husky pre-commit hook)
 * Bypass: include "bypass migration check" in the commit message.
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..', '..')

const run = (cmd: string): string => execSync(cmd, { cwd: rootDir }).toString().trim()

const main = (): void => {
  const msgArg = process.argv[2]
  const commitMsgPath = msgArg ? resolve(msgArg) : resolve(rootDir, '.git', 'COMMIT_EDITMSG')
  if (existsSync(commitMsgPath)) {
    const msg = execSync(`cat ${commitMsgPath}`).toString()
    if (msg.includes('bypass migration check')) {
      console.log('bypass migration check directive found, skipping.')
      process.exit(0)
    }
  }

  const staged = run('git diff --cached --name-status')
  if (!staged) return

  const entityChanged = staged.split('\n').some((line) => {
    const parts = line.trim().split(/\s+/)
    return parts[1]?.startsWith('server/entities/')
  })
  if (!entityChanged) return

  const migrationAdded = staged.split('\n').some((line) => {
    const parts = line.trim().split(/\s+/)
    return parts[0] === 'A' && parts[1]?.startsWith('server/migrations/')
  })

  if (!migrationAdded) {
    console.error('Entity changes detected without a new migration.')
    console.error('Run: pnpm db:generate -- --name=<Name>')
    console.error('To bypass: include "bypass migration check" in your commit message.')
    process.exit(1)
  }
}

main()
