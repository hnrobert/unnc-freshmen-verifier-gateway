/** The caller's effective role on this org (owner / manager / editor / viewer / null). Viewer+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const access = await getOrgAccess(event, slug)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  return { role: access.role, rank: access.rank }
})
