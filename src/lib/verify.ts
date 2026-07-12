/**
 * Verification entry point used by the verify page. Routes to one of three paths
 * based on `gateway`:
 *   - `mock`     → admit any well-formed input (UI preview, no portal/backend).
 *   - `backend`  → POST `gateway.api`; a Node backend does the portal query.
 *   - `browser`  → run the ported client in the browser through `gateway.proxy`.
 */
import siteConfig from '@config/site.config'
import { queryAdmission } from './admissionClient'
import type { AdmissionResult } from '@/shared/types'

const ID_PATTERN = /^\d{17}[\dX]$/

export interface VerifyInput {
  name: string
  idNumber: string
}

export type VerifyReason =
  | 'empty_name'
  | 'bad_id_format'
  | 'not_admitted'
  | 'captcha'
  | 'network'
  | 'generic'
  | 'ok'

export interface VerifyOutput {
  ok: boolean
  reason: VerifyReason
  /** Portal-returned details when admitted (name/university/date/detail). */
  admission?: AdmissionResult
}

/** Synchronous format validation; returns `null` when the input is well-formed. */
export function validateInput(input: VerifyInput): VerifyOutput | null {
  if (!input.name.trim()) return { ok: false, reason: 'empty_name' }
  if (!ID_PATTERN.test(input.idNumber.trim().toUpperCase())) {
    return { ok: false, reason: 'bad_id_format' }
  }
  return null
}

function classifyError(message: string): VerifyReason {
  if (/captcha|验证码|滑块/i.test(message)) return 'captcha'
  if (/网络|network|超时|timeout|fail|abort|request|请求|warmup|post|missing/i.test(message)) {
    return 'network'
  }
  return 'generic'
}

/** Map an AdmissionResult (from backend or browser client) to UI reasons. */
function mapResult(result: AdmissionResult): VerifyOutput {
  if (result.ok && result.admitted === true) {
    return { ok: true, reason: 'ok', admission: result }
  }
  if (result.ok && result.admitted === false) {
    return { ok: false, reason: 'not_admitted', admission: result }
  }
  return { ok: false, reason: classifyError(result.message) }
}

export async function verify(input: VerifyInput): Promise<VerifyOutput> {
  const invalid = validateInput(input)
  if (invalid) return invalid

  if (siteConfig.gateway.mode === 'mock') {
    return {
      ok: true,
      reason: 'ok',
      admission: { ok: true, admitted: true, message: 'mock', name: input.name },
    }
  }

  if (siteConfig.gateway.transport === 'backend') {
    try {
      const res = await fetch(siteConfig.gateway.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: input.name, userid: input.idNumber }),
      })
      if (!res.ok) return { ok: false, reason: 'network' }
      return mapResult((await res.json()) as AdmissionResult)
    } catch {
      return { ok: false, reason: 'network' }
    }
  }

  // transport === 'browser'
  try {
    return mapResult(await queryAdmission(siteConfig.gateway, input.name, input.idNumber))
  } catch {
    return { ok: false, reason: 'network' }
  }
}
