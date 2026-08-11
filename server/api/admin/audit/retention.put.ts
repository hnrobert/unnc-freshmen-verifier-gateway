import { setAuditRetentionDays } from '#server/utils/stats'

/** PUT /api/admin/audit/retention — set the audit log retention (days). */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ retentionDays?: unknown }>(event)
  const n = Number(body?.retentionDays)
  if (!Number.isInteger(n) || n < 1)
    throw createError({
      statusCode: 400,
      statusMessage: 'Retention must be a positive integer (days)',
    })

  await setAuditRetentionDays(n)
  return { retentionDays: n }
})
