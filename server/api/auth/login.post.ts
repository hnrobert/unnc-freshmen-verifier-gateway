import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { signTrustJwt, setTrustCookie, getTrustWindowMs } from '#server/utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body?.password ?? '')

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { email } })
  if (!user || !verifyPassword(password, user.passwordHash))
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  await createSession(event, user.id)

  const trustedUntil = new Date(Date.now() + getTrustWindowMs())
  await userRepo.update(user.id, { trustedUntil })
  const token = signTrustJwt(user.id, user.email, trustedUntil)
  setTrustCookie(event, token)

  return { user: { id: user.id, email: user.email, role: user.role } }
})
