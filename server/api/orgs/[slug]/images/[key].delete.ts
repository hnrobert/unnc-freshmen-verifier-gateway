import { AppDataSource } from '#server/utils/database'
import { OrgImage } from '#server/entities/orgImage.entity'

/** Delete a stored org image (e.g. the welcome QR or background). Editor floor,
 * matching the upload route. Idempotent — deleting a missing key is a no-op so
 * the editor's "delete current image" button works even if the row is already
 * gone. The caller clears the config reference afterwards. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string
  const { org } = await requireOrgRole(event, slug, RANK.editor)

  const repo = AppDataSource.getRepository(OrgImage)
  await repo.delete({ orgId: org.id, key })
  invalidateImageCache(org.id)
  return { ok: true, key }
})
