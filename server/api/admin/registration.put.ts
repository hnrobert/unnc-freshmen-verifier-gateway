import { setEmailWhitelist } from '#server/utils/registration'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ enabled?: unknown; patterns?: unknown[] }>(event)
  const enabled = Boolean(body?.enabled)
  const patterns = Array.isArray(body?.patterns)
    ? body.patterns.map((p) => (typeof p === 'string' ? p.trim() : '')).filter((p) => p.length > 0)
    : []

  await setEmailWhitelist({ enabled, patterns })
  return { enabled, patterns }
})
