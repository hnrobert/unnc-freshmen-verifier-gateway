/** Superadmin-only: site-wide analytics overview aggregating EVERY page (the
 * "All Organisations" 看板). Same shape as GET /api/stats/overview. */
export default defineEventHandler((event) => {
  requireSuperAdmin(event)
  return readOverviewStatsAll(getQuery(event).range)
})
