/** Per-page statistics (totals + daily series + breakdowns). Viewer+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.viewer)
  return await readStats(page.id, getQuery(event).range)
})
