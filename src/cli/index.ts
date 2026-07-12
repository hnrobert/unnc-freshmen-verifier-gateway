#!/usr/bin/env node
/**
 * unnc-vg — config CLI for the UNNC freshmen verifier gateway.
 *
 *   gen        Read config/students.csv, hash each name|id with the configured
 *              salt, and write src/generated/verifiers.json (consumed by the SPA).
 *   validate   Check config/site.config.ts for required fields & message keys.
 *   help       Show usage.
 *
 * In this project the CLI is run through tsx (`pnpm gen` / `pnpm validate`),
 * which resolves the live `config/site.config.ts`. tsup bundles a distributable
 * copy (`pnpm build:cli` -> dist-cli/cli.mjs); because config is loaded
 * dynamically from process.cwd(), the bundled CLI also reads the caller's config
 * when run on Node 24 (native TS type-stripping).
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { hashStudent, normalizeId, normalizeName } from '../shared/hash'
import type { IconRef, Locale, SiteConfig, StudentEntry } from '../shared/types'

const cwd = process.cwd()
const STUDENTS_FILE = resolve(cwd, 'config/students.csv')
const STUDENTS_EXAMPLE = resolve(cwd, 'config/students.example.csv')
const VERIFIERS_FILE = resolve(cwd, 'src/generated/verifiers.json')
const ICONS_FILE = resolve(cwd, 'src/generated/icons.ts')
const CONFIG_FILE = resolve(cwd, 'config/site.config.ts')

const ID_PATTERN = /^\d{17}[\dX]$/
const FALLBACK_ICON = 'CircleHelp'

/* ----------------------------------------------------------------- config -- */

async function loadConfig(): Promise<SiteConfig> {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(`config/site.config.ts not found at ${CONFIG_FILE}`)
  }
  const mod = (await import(pathToFileURL(CONFIG_FILE).href)) as {
    default: SiteConfig
  }
  return mod.default
}

/* ------------------------------------------------------------------- csv --- */

/** Minimal RFC-4180-ish CSV parser supporting quoted fields and "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function parseStudents(text: string): StudentEntry[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const nameIdx = header.findIndex((h) => h === 'name' || h.includes('name') || h.includes('姓名'))
  const idIdx = header.findIndex(
    (h) => h === 'id_number' || h === 'id' || h.includes('id') || h.includes('身份证'),
  )

  const out: StudentEntry[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    const name = (nameIdx >= 0 ? cells[nameIdx] : cells[0]) ?? ''
    const id = (idIdx >= 0 ? cells[idIdx] : cells[1]) ?? ''
    if (!name.trim() && !id.trim()) continue
    out.push({ name: name.trim(), idNumber: id.trim() })
  }
  return out
}

/* ------------------------------------------------------------------ gen --- */

async function gen(): Promise<void> {
  const config = await loadConfig()

  const file = existsSync(STUDENTS_FILE)
    ? STUDENTS_FILE
    : existsSync(STUDENTS_EXAMPLE)
      ? STUDENTS_EXAMPLE
      : null

  if (!file) {
    console.error(
      '✗ No students file found.\n' +
        '  Expected config/students.csv (or config/students.example.csv).\n' +
        '  See config/students.example.csv for the format.',
    )
    process.exit(1)
  }

  const usingExample = file === STUDENTS_EXAMPLE
  const text = await readFile(file, 'utf8')
  const students = parseStudents(text)
  if (students.length === 0) {
    console.warn('⚠ No student rows parsed; writing an empty verifier list.')
  }

  const seen = new Set<string>()
  const hashes: string[] = []
  let skipped = 0

  for (const s of students) {
    const name = normalizeName(s.name)
    const id = normalizeId(s.idNumber)
    if (!name || !ID_PATTERN.test(id)) {
      skipped++
      continue
    }
    const hash = await hashStudent(config.salt, { name, idNumber: id })
    if (!seen.has(hash)) {
      seen.add(hash)
      hashes.push(hash)
    }
  }

  await mkdir(dirname(VERIFIERS_FILE), { recursive: true })
  await writeFile(VERIFIERS_FILE, `${JSON.stringify(hashes, null, 2)}\n`, 'utf8')

  const rel = VERIFIERS_FILE.replace(cwd + '/', '')
  console.log(`✓ Wrote ${hashes.length} verifier hash(es) → ${rel}`)
  if (usingExample) {
    console.log('  (used students.example.csv — create config/students.csv for real data)')
  }
  if (skipped > 0) {
    console.warn(`  ⚠ Skipped ${skipped} invalid row(s) (missing name or bad ID format).`)
  }

  await generateIcons(config)
}

/* ----------------------------------------------------------- icon-codegen -- */

/** Collect every lucide icon name referenced by the config. */
function collectIconNames(config: SiteConfig): string[] {
  const names = new Set<string>([FALLBACK_ICON])
  for (const ref of Object.values(config.icons) as IconRef[]) {
    const name = typeof ref === 'string' ? ref : ref?.lucide
    if (name) names.add(name)
  }
  return [...names]
}

/**
 * Validate the config's icon names against lucide-vue-next and write a tiny
 * registry module that imports only the icons actually used — keeping the SPA
 * bundle small while still allowing any lucide name in config.
 */
async function generateIcons(config: SiteConfig): Promise<void> {
  const wanted = collectIconNames(config)

  let valid = wanted
  let lucide: Record<string, unknown> | null = null
  try {
    lucide = (await import('lucide-vue-next')) as Record<string, unknown>
  } catch {
    // lucide-vue-next not resolvable from the CLI (e.g. bundled bin without the
    // dep installed) — emit all names unvalidated; an invalid one will surface
    // as a build error.
  }

  if (lucide) {
    valid = wanted.filter((n) => typeof lucide![n] !== 'undefined')
    const invalid = wanted.filter((n) => n !== FALLBACK_ICON && typeof lucide![n] === 'undefined')
    if (invalid.length > 0) {
      console.warn(
        `  ⚠ Unknown lucide icon(s) in config: ${invalid.join(', ')}. ` +
          `They will render as the fallback (${FALLBACK_ICON}).`,
      )
    }
  }
  if (!valid.includes(FALLBACK_ICON)) valid.push(FALLBACK_ICON)

  const deduped = [...new Set(valid)].sort()
  const imports = deduped.join(', ')
  const entries = deduped.map((n) => `  ${n},`).join('\n')
  const body =
    `// AUTO-GENERATED by \`pnpm gen\` — do not edit by hand.\n` +
    `// Only the icons referenced in config/site.config.ts are imported, so the\n` +
    `// lucide-vue-next bundle stays small. Change an icon in config then re-run gen.\n` +
    `import type { Component } from 'vue'\n` +
    `import { ${imports} } from 'lucide-vue-next'\n\n` +
    `export const iconRegistry: Record<string, Component> = {\n${entries}\n}\n`

  await mkdir(dirname(ICONS_FILE), { recursive: true })
  await writeFile(ICONS_FILE, body, 'utf8')
  console.log(`✓ Wrote icon registry (${deduped.length} icons) → ${ICONS_FILE.replace(cwd + '/', '')}`)
}

/* ------------------------------------------------------------- validate --- */

function deepGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

const REQUIRED_KEYS = [
  'brand.title',
  'brand.subtitle',
  'verify.heading',
  'verify.subheading',
  'verify.nameLabel',
  'verify.namePlaceholder',
  'verify.idLabel',
  'verify.idPlaceholder',
  'verify.submit',
  'verify.submitting',
  'errors.emptyName',
  'errors.badIdFormat',
  'errors.notFound',
  'errors.generic',
  'welcome.badge',
  'welcome.title',
  'welcome.body',
  'welcome.imageAlt',
  'welcome.back',
  'theme.toggle',
  'lang.label',
  'footer',
]

async function validate(): Promise<void> {
  const config = await loadConfig()
  const errors: string[] = []

  if (!config.locales || config.locales.length === 0) errors.push('locales is empty')
  if (!config.defaultLocale) errors.push('defaultLocale is missing')
  else if (!config.locales.includes(config.defaultLocale)) {
    errors.push(`defaultLocale "${config.defaultLocale}" is not listed in locales`)
  }
  if (!config.salt || !config.salt.trim()) {
    errors.push('salt is empty — set a deployment-specific salt')
  }
  if (!config.messages) errors.push('messages is missing')

  for (const loc of config.locales) {
    const messages = config.messages[loc as Locale]
    if (!messages) {
      errors.push(`messages.${loc} is missing`)
      continue
    }
    for (const key of REQUIRED_KEYS) {
      const value = deepGet(messages, key)
      if (value === undefined || value === null || value === '') {
        errors.push(`messages.${loc}.${key} is missing`)
      }
    }
  }

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} config problem(s):`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log('✓ site.config.ts looks good.')
}

/* ----------------------------------------------------------------- help --- */

function help(): void {
  console.log(
    [
      'unnc-vg — UNNC freshmen verifier gateway CLI',
      '',
      'Usage:',
      '  unnc-vg gen        Generate src/generated/verifiers.json from config/students.csv',
      '  unnc-vg validate   Validate config/site.config.ts',
      '  unnc-vg help       Show this message',
    ].join('\n'),
  )
}

/* ----------------------------------------------------------------- main --- */

async function main(): Promise<void> {
  const cmd = process.argv[2]
  switch (cmd) {
    case 'gen':
      await gen()
      break
    case 'validate':
      await validate()
      break
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      help()
      break
    default:
      console.error(`Unknown command: ${cmd}\n`)
      help()
      process.exit(1)
  }
}

await main()
