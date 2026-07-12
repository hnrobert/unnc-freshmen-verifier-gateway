/**
 * Hashing + normalization shared by the CLI (`gen`) and the browser verify lib.
 *
 * IMPORTANT: both consumers must apply exactly the same transformation, so this
 * single module is imported by each. It relies only on the Web Crypto
 * `crypto.subtle` API, which is available globally in Node 24 and all modern
 * browsers.
 */
import type { StudentEntry } from './types'

const encoder = new TextEncoder()

/** Normalize a name: trim and collapse internal whitespace. */
export function normalizeName(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, ' ')
}

/** Normalize an ID number: trim and uppercase (final check digit may be `X`). */
export function normalizeId(id: string): string {
  return (id ?? '').trim().toUpperCase()
}

/** Build the canonical preimage hashed for a (name, id) pair. */
export function preimage(salt: string, name: string, id: string): string {
  return `${salt}|${normalizeName(name)}|${normalizeId(id)}`
}

/** SHA-256 hex digest of an arbitrary string. Async (Web Crypto) in both runtimes. */
export async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash a student entry with the given salt into its verifier token. */
export async function hashStudent(salt: string, entry: StudentEntry): Promise<string> {
  return sha256Hex(preimage(salt, entry.name, entry.idNumber))
}
