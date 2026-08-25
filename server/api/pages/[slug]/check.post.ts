import type { AdmissionResult } from '#shared/types'
import { queryAdmission } from '#server/utils/admission'
import { setVerifyCookie, signVerifyJwt, verifyVerifyJwt } from '#server/utils/jwt'

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}
function normalizeId(s: string): string {
  return s.trim().toUpperCase()
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string

  // Site-wide kill switch (admin panel → Verification). Refused before any
  // portal traffic, for every branch incl. trusted/reused cookies.
  const settings = await getVerificationSettings()
  if (!settings.freshmanEnabled)
    throw createError({ statusCode: 403, statusMessage: 'Freshman verification is disabled' })

  const config = await loadPageConfig(slug)
  const page = await getPageBySlug(slug)

  const body = await readBody<{
    username?: unknown
    name?: unknown
    userid?: unknown
    id_number?: unknown
    idNumber?: unknown
  }>(event)
  const username = String(body?.username ?? body?.name ?? '').trim()
  const userid = String(body?.userid ?? body?.id_number ?? body?.idNumber ?? '').trim()

  if (!username || !userid) {
    if (page)
      void recordVerify(event, page.id, {
        outcome: 'missing',
        mode: null,
        name: null,
        idHash: null,
      })
    return {
      ok: false,
      admitted: null,
      message: 'missing username/userid',
    } satisfies AdmissionResult
  }

  const normName = normalizeName(username)
  const normId = normalizeId(userid)
  const idHash = hashIdNumber(normId)
  const deviceHash = deviceHashFromRequest(event)

  // --- Device-bound trust bypass: same name + ID (by hash) + same browser ---
  // Re-submitting the form on a device that already earned a verify JWT skips
  // the portal. Compares the salted ID hash (never plaintext) and the device
  // fingerprint bound into the token.
  const verifyTrust = verifyVerifyJwt(event)
  if (
    verifyTrust &&
    verifyTrust.idHash &&
    verifyTrust.deviceHash &&
    new Date(verifyTrust.trustedUntil) > new Date() &&
    normalizeName(verifyTrust.name) === normName &&
    verifyTrust.idHash === idHash &&
    verifyTrust.deviceHash === deviceHash
  ) {
    if (page) {
      void upsertVerifiedIdentity(page.id, normName, idHash)
      void recordVerify(event, page.id, {
        outcome: 'admitted',
        mode: 'trusted',
        name: username,
        idHash,
      })
    }
    return {
      ...(verifyTrust.admission ?? {}),
      ok: true,
      admitted: true,
      message: 'trusted',
      name: username,
    } satisfies AdmissionResult
  }

  // --- Per-page "already used" fast-path: name + ID hash verified here before ---
  // Returning members are re-admitted without re-querying the UNNC portal.
  if (page && idHash && (await findVerifiedIdentity(page.id, idHash))) {
    const token = signVerifyJwt(normName, idHash, deviceHash)
    setVerifyCookie(event, token)
    void recordVerify(event, page.id, {
      outcome: 'admitted',
      mode: 'reused',
      name: username,
      idHash,
    })
    return { ok: true, admitted: true, message: 'reused', name: username } satisfies AdmissionResult
  }

  // --- Mock mode ---
  if (config.gateway.mode === 'mock') {
    const admission: AdmissionResult = { ok: true, admitted: true, message: 'mock', name: username }
    const token = signVerifyJwt(normName, idHash ?? '', deviceHash, admission)
    setVerifyCookie(event, token)
    if (page) {
      void upsertVerifiedIdentity(page.id, normName, idHash)
      void recordVerify(event, page.id, {
        outcome: 'admitted',
        mode: 'mock',
        name: username,
        idHash,
      })
    }
    return admission
  }

  // --- Portal check ---
  let result: AdmissionResult
  try {
    result = await queryAdmission(config.gateway, username, userid)
  } catch (error) {
    result = {
      ok: false,
      admitted: null,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  // On successful admission: bind a device-bound verify JWT (carries the cached
  // result so a cross-page skip can render the welcome page) + record the identity.
  if (result.ok && result.admitted === true) {
    const token = signVerifyJwt(normName, idHash ?? '', deviceHash, result)
    setVerifyCookie(event, token)
    if (page) void upsertVerifiedIdentity(page.id, normName, idHash)
  }

  // Record the live outcome (fire-and-forget; never blocks the response).
  if (page) {
    const outcome =
      result.admitted === true ? 'admitted' : result.admitted === false ? 'not_found' : 'error'
    void recordVerify(event, page.id, {
      outcome,
      mode: 'live',
      name: result.name ?? username,
      idHash,
    })
  }

  return result
})
