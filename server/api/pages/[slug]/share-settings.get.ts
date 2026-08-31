import { loadPageShareSettings } from '#server/utils/pageShareSettings'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.viewer)
  return await loadPageShareSettings(page.id)
})
