import { AppDataSource } from '#server/utils/database'
import { PageImage } from '#server/entities/pageImage.entity'

/** Delete a stored page image (e.g. the welcome QR or background). Editor floor,
 * matching the upload route. Idempotent — deleting a missing key is a no-op so
 * the editor's "delete current image" button works even if the row is already
 * gone. The caller clears the config reference afterwards. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)

  const repo = AppDataSource.getRepository(PageImage)
  await repo.delete({ pageId: page.id, key })
  invalidateImageCache(page.id)
  return { ok: true, key }
})
