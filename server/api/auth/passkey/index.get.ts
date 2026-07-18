import { AppDataSource } from '#server/utils/database'
import { Passkey } from '#server/entities/passkey.entity'

/** List the caller's own passkeys (never exposes the public key or counter). */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const passkeys = await AppDataSource.getRepository(Passkey).find({
    where: { userId: me.id },
    order: { id: 'ASC' },
  })
  return {
    passkeys: passkeys.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      createdAt: p.createdAt,
    })),
  }
})
