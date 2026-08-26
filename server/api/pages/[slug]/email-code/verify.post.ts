import type { AdmissionResult } from '#shared/types'
import { EMAIL_TRUST_WINDOW_MS, setVerifyCookie, signVerifyJwt } from '#server/utils/jwt'
import { getVerificationSettings } from '#server/utils/verification'

/**
 * Public (code mode): verify the 6-digit code. On success issues the SAME
 * device-bound trust cookie as the freshman flow (vg_verify), but with a
 * 30-day window — the visitor is recognized across pages and return visits
 * without re-verifying. Also records stats (outcome admitted / mode email) and
 * remembers the identity for the per-page fast-path.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const settings = await getVerificationSettings()
  if (!settings.emailModes.includes('code'))
    throw createError({ statusCode: 403, statusMessage: 'Code flow is not enabled' })

  const body = await readBody<{
    email?: unknown
    session?: unknown
    code?: unknown
    trust?: unknown
  }>(event)
  // "Trust this browser" opt-out (default on). When off, the code still
  // verifies and the welcome page shows — just no 30-day trust cookie.
  const trustBrowser = body?.trust !== false
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const session = String(body?.session ?? '').trim()
  const code = String(body?.code ?? '').trim()

  if (!email.endsWith('@nottingham.edu.cn') || !session || !/^\d{6}$/.test(code))
    throw createError({ statusCode: 400, statusMessage: 'Invalid request' })

  const page = await getPageBySlug(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

  if (!consumeCode(email, session, code))
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired code' })

  // Same trust mechanics as the freshman flow (device-bound verify JWT), with
  // the email flow's 30-day window. idHash = salted hash of the address.
  const prefix = email.split('@')[0] ?? email
  const idHash = hashIdNumber(email)
  const deviceHash = deviceHashFromRequest(event)
  const admission: AdmissionResult = { ok: true, admitted: true, message: 'email', name: prefix }
  const token = signVerifyJwt(prefix, idHash ?? '', deviceHash, admission, EMAIL_TRUST_WINDOW_MS)
  if (trustBrowser) setVerifyCookie(event, token, EMAIL_TRUST_WINDOW_MS)

  void upsertVerifiedIdentity(page.id, prefix, idHash)
  void recordVerify(event, page.id, {
    outcome: 'admitted',
    mode: 'email',
    name: prefix,
    idHash,
  })

  return admission
})
