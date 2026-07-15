import type { AdmissionResult } from '../../../../shared/types'
import { queryAdmission } from '../../../utils/admission'
import { verifyTrustJwt } from '../../../utils/jwt'
import { AppDataSource } from '../../../utils/database'
import { Verification } from '../../../entities/verification.entity'

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

  // --- Trust window: if user has a valid JWT + verified before, skip everything ---
  const trust = verifyTrustJwt(event)
  const trustActive = trust && new Date(trust.trustedUntil) > new Date()
  if (trustActive) {
    const verRepo = AppDataSource.getRepository(Verification)
    const hasVerified = await verRepo.findOne({ where: { userId: trust.userId } })
    if (hasVerified) {
      return { ok: true, admitted: true, message: 'trusted', name: username } satisfies AdmissionResult
    }
  }

  // --- Mock mode ---
  if (config.gateway.mode === 'mock') {
    const result = { ok: true, admitted: true, message: 'mock', name: username } satisfies AdmissionResult
    if (trustActive) {
      const verRepo = AppDataSource.getRepository(Verification)
      await verRepo.save({ userId: trust!.userId, orgSlug: slug, name: username, idNumber: userid })
    }
    return result
  }

  // --- Portal check ---
  let result: AdmissionResult
  try {
    result = await queryAdmission(config.gateway, username, userid)
  } catch (error) {
    result = { ok: false, admitted: null, message: error instanceof Error ? error.message : String(error) }
  }

  // Record successful verification for trusted users
  if (result.ok && result.admitted === true && trustActive) {
    const verRepo = AppDataSource.getRepository(Verification)
    await verRepo.save({ userId: trust!.userId, orgSlug: slug, name: username, idNumber: userid })
  }

  return result
})
