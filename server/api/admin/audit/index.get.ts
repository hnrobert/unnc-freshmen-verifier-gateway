import { readAudit, getAuditRetentionDays } from '#server/utils/stats'

/** GET /api/admin/audit — site-wide audit trail (superadmin). */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const q = getQuery(event)
  const pageId = q.pageId != null && q.pageId !== '' ? Number(q.pageId) : null
  const userId = q.userId != null && q.userId !== '' ? Number(q.userId) : null
  const result = await readAudit({
    action: typeof q.action === 'string' && q.action ? q.action : null,
    outcome: typeof q.outcome === 'string' && q.outcome ? q.outcome : null,
    pageId: pageId != null && Number.isFinite(pageId) ? pageId : null,
    userId: userId != null && Number.isFinite(userId) ? userId : null,
    search: typeof q.search === 'string' && q.search.trim() ? q.search.trim() : null,
    from: typeof q.from === 'string' && q.from ? q.from : null,
    to: typeof q.to === 'string' && q.to ? q.to : null,
    limit: q.limit != null && q.limit !== '' ? Number(q.limit) : 100,
    offset: q.offset != null && q.offset !== '' ? Number(q.offset) : 0,
  })
  return { ...result, retentionDays: await getAuditRetentionDays() }
})
