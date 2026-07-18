/** Public page-view beacon. Records a 'view' event; never 4xx's (a failed beacon
 * must not surface in the visitor console). Called once per real page load from
 * pages/[slug]/index.vue onMounted (not from /preview). */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = await getOrgBySlug(slug)
  if (!org) return { ok: false }
  await recordView(event, org.id)
  return { ok: true }
})
