/** Cross-page analytics overview for the dashboard 看板 (aggregates every page the
 * caller can access). Session-only — it reads the caller's accessible pages. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  return await readOverviewStats(user.id, getQuery(event).range)
})
