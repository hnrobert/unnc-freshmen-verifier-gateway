/** Per-org statistics (totals + daily series + breakdowns). Viewer+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { org } = await requireOrgRole(event, slug, RANK.viewer)
  return await readStats(org.id, getQuery(event).range)
})
