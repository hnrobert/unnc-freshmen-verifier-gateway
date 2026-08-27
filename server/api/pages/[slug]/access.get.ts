/** The caller's effective role on an page (owner / manager / editor / viewer /
 * superadmin / null), plus the page's own identity — a superadmin opening a
 * page they don't own via the admin route gets role 'superadmin' here, which
 * the owner-only UI (rename/delete) treats as full control. Viewer+. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const access = await getPageAccess(event, slug)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  return {
    role: access.role,
    rank: access.rank,
    page: { slug: access.page.slug, name: access.page.name },
  }
})
