/** The caller's effective role on this page (owner / manager / editor / viewer / null). Viewer+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const access = await getPageAccess(event, slug)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  return { role: access.role, rank: access.rank }
})
