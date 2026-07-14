import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

export type DB = BetterSQLite3Database<typeof schema>

/**
 * Open (or reuse) a better-sqlite3 connection + Drizzle instance for a given path.
 * Shared by the Nitro `useDB()` and the standalone seed script.
 */
export function createDB(dbPath: string): { sqlite: Database.Database; db: DB } {
  const resolved = resolve(dbPath)
  mkdirSync(resolve(resolved, '..'), { recursive: true })
  const sqlite = new Database(resolved)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

let cached: DB | null = null

/** Nitro-side DB accessor. Uses `runtimeConfig.dbPath`; cached for the process. */
export function useDB(): DB {
  if (!cached) {
    const { db } = createDB(useRuntimeConfig().dbPath)
    cached = db
  }
  return cached
}
