/** Cross-org analytics overview for the dashboard 看板 (aggregates every org the
 * caller can access). Session-only — it reads the caller's accessible orgs. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  return await readOverviewStats(user.id, getQuery(event).range)
})
