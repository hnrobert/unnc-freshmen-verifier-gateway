import type { AdmissionResult } from '../../../../shared/types'
import { queryAdmission } from '../../../utils/admission'
import { verifyVerifyJwt, signVerifyJwt, setVerifyCookie } from '../../../utils/jwt'

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}
function normalizeId(s: string): string {
  return s.trim().toUpperCase()
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const config = await loadOrgConfig(slug)

  const body = await readBody<{
    username?: unknown; name?: unknown
    userid?: unknown; id_number?: unknown; idNumber?: unknown
  }>(event)
  const username = String(body?.username ?? body?.name ?? '').trim()
  const userid = String(body?.userid ?? body?.id_number ?? body?.idNumber ?? '').trim()

  if (!username || !userid)
    return { ok: false, admitted: null, message: 'missing username/userid' } satisfies AdmissionResult

  const normName = normalizeName(username)
  const normId = normalizeId(userid)

  // --- Trust bypass: verify JWT (name+ID based, works for all visitors) ---
  const verifyTrust = verifyVerifyJwt(event)
  if (verifyTrust && new Date(verifyTrust.trustedUntil) > new Date()) {
    if (normalizeName(verifyTrust.name) === normName && normalizeId(verifyTrust.idNumber) === normId) {
      return { ok: true, admitted: true, message: 'trusted', name: username } satisfies AdmissionResult
    }
  }

  // --- Mock mode ---
  if (config.gateway.mode === 'mock') {
    const token = signVerifyJwt(normName, normId)
    setVerifyCookie(event, token)
    return { ok: true, admitted: true, message: 'mock', name: username } satisfies AdmissionResult
  }

  // --- Portal check ---
  let result: AdmissionResult
  try {
    result = await queryAdmission(config.gateway, username, userid)
  } catch (error) {
    result = { ok: false, admitted: null, message: error instanceof Error ? error.message : String(error) }
  }

  // On successful admission: issue verify JWT for future cross-org trust
  if (result.ok && result.admitted === true) {
    const token = signVerifyJwt(normName, normId)
    setVerifyCookie(event, token)
  }

  return result
})
