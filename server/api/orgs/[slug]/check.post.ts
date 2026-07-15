import type { AdmissionResult } from '../../../../shared/types'
import { queryAdmission } from '../../../utils/admission'

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
  if (config.gateway.mode === 'mock')
    return { ok: true, admitted: true, message: 'mock', name: username } satisfies AdmissionResult

  try {
    return await queryAdmission(config.gateway, username, userid)
  } catch (error) {
    return { ok: false, admitted: null, message: error instanceof Error ? error.message : String(error) } satisfies AdmissionResult
  }
})
