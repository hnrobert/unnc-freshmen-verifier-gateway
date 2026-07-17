import { AppDataSource } from '../../utils/database'
import { User } from '../../entities/user.entity'
import { signTrustJwt, setTrustCookie, getTrustWindowMs } from '../../utils/jwt'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  if (!EMAIL_RE.test(email) || password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Invalid email or password (min 8 chars)' })

  const repo = AppDataSource.getRepository(User)
  const existing = await repo.findOne({ where: { email } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already registered' })

  // First registered user becomes superadmin; all others are admin.
  const userCount = await repo.count()
  const role = userCount === 0 ? 'superadmin' : 'admin'

  const trustedUntil = new Date(Date.now() + getTrustWindowMs())
  const user = await repo.save({ email, passwordHash: hashPassword(password), trustedUntil, role })
  await createSession(event, user.id)

  const token = signTrustJwt(user.id, user.email, trustedUntil)
  setTrustCookie(event, token)

  return { user: { id: user.id, email: user.email, role: user.role } }
})
