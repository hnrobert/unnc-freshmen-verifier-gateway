/**
 * Client-side verification against the build-time-generated hash allow-list.
 *
 * The allow-list lives at `src/generated/verifiers.json` and is produced by the
 * CLI (`pnpm gen`) from `config/students.csv`. Verification hashes the visitor's
 * input with the same salt and checks membership — raw names/IDs are never
 * shipped to the browser.
 */
import verifiers from '@/generated/verifiers.json'
import siteConfig from '@config/site.config'
import { hashStudent } from '@/shared/hash'

const VERIFIER_SET: ReadonlySet<string> = new Set(verifiers as string[])

/** 18-digit Chinese ID: 17 digits + a final digit or `X`. */
const ID_PATTERN = /^\d{17}[\dX]$/

export interface VerifyInput {
  name: string
  idNumber: string
}

export type VerifyReason = 'empty_name' | 'bad_id_format' | 'not_found' | 'ok'

export interface VerifyResult {
  ok: boolean
  reason: VerifyReason
}

/** Synchronous format validation; returns `null` when the input is well-formed. */
export function validateInput(input: VerifyInput): VerifyResult | null {
  if (!input.name.trim()) return { ok: false, reason: 'empty_name' }
  if (!ID_PATTERN.test(input.idNumber.trim().toUpperCase())) {
    return { ok: false, reason: 'bad_id_format' }
  }
  return null
}

/**
 * Verify a name + ID. Resolves `ok: true` only when the hashed pair exists in the
 * allow-list. Network-free and fully static.
 */
export async function verify(input: VerifyInput): Promise<VerifyResult> {
  const invalid = validateInput(input)
  if (invalid) return invalid

  const hash = await hashStudent(siteConfig.salt, {
    name: input.name,
    idNumber: input.idNumber,
  })
  return VERIFIER_SET.has(hash)
    ? { ok: true, reason: 'ok' }
    : { ok: false, reason: 'not_found' }
}

/** Whether any verifiers are configured (false for an unconfigured gateway). */
export function hasVerifiers(): boolean {
  return VERIFIER_SET.size > 0
}
