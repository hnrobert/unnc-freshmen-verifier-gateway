export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await requireOrgOwnership(event, slug)
  await deleteOrgCascade(org.id)
  invalidateOrgConfig(slug)
  return { ok: true }
})
