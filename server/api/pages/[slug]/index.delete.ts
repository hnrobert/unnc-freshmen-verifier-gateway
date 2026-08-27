export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const page = await requirePageOwnership(event, slug)
  const actor = requireAuth(event)
  await deletePageCascade(page.id)
  invalidatePageConfig(slug)
  void recordAudit(event, {
    action: 'page.delete',
    outcome: 'success',
    actorType: 'user',
    userId: actor.id,
    email: actor.email,
    pageId: page.id,
    name: page.name,
    detail: { slug },
  })
  return { ok: true }
})
