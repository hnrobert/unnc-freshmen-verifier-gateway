export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await requireOrgOwnership(event, slug)
  const actor = requireAuth(event)
  await deleteOrgCascade(org.id)
  invalidateOrgConfig(slug)
  void recordAudit(event, {
    action: 'org.delete',
    outcome: 'success',
    actorType: 'user',
    userId: actor.id,
    email: actor.email,
    orgId: org.id,
    name: org.name,
    detail: { slug },
  })
  return { ok: true }
})
