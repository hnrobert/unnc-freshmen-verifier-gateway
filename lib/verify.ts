import type { AdmissionResult, GatewayConfig } from '#shared/types'

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
  /** Portal-returned details when admitted. */
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
  if (/网络|network|超时|timeout|fail|abort|request|请求|missing/i.test(message)) return 'network'
  return 'generic'
}

function mapResult(result: AdmissionResult): VerifyOutput {
  if (result.ok && result.admitted === true) {
    return { ok: true, reason: 'ok', admission: result }
  }
  if (result.ok && result.admitted === false) {
    return { ok: false, reason: 'not_admitted', admission: result }
  }
  return { ok: false, reason: classifyError(result.message) }
}

/**
 * Verify a name + ID against the org's gateway. POSTs to the Nitro
 * `/api/orgs/:slug/check` route (which calls the portal server-side).
 */
export async function verify(
  slug: string,
  gateway: GatewayConfig,
  input: VerifyInput,
): Promise<VerifyOutput> {
  const invalid = validateInput(input)
  if (invalid) return invalid

  if (gateway.mode === 'mock') {
    return {
      ok: true,
      reason: 'ok',
      admission: { ok: true, admitted: true, message: 'mock', name: input.name },
    }
  }

  try {
    const result = await $fetch<AdmissionResult>(`/api/orgs/${slug}/check`, {
      method: 'POST',
      body: { username: input.name, userid: input.idNumber },
    })
    return mapResult(result)
  } catch (e: unknown) {
    return { ok: false, reason: classifyError(messageFromError(e, 'network')) }
  }
}
