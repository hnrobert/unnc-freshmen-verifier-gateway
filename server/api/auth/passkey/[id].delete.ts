import { AppDataSource } from '#server/utils/database'
import { Passkey } from '#server/entities/passkey.entity'

/** Remove one of the caller's own passkeys. Returns 404 (not 403) for passkeys
 * owned by others so ownership can't be probed. */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const repo = AppDataSource.getRepository(Passkey)
  const passkey = await repo.findOne({ where: { id } })
  if (!passkey || passkey.userId !== me.id)
    throw createError({ statusCode: 404, statusMessage: 'Passkey not found' })

  await repo.delete({ id })
  return { ok: true }
})
