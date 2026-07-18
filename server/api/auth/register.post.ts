import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { signTrustJwt, setTrustCookie, getTrustWindowMs } from '#server/utils/jwt'
import { getEmailWhitelist, emailMatchesWhitelist } from '#server/utils/registration'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body?.password ?? '')
  if (!EMAIL_RE.test(email) || password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Invalid email or password (min 8 chars)' })

  const repo = AppDataSource.getRepository(User)
  const existing = await repo.findOne({ where: { email } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already registered' })

  // First registered user becomes superadmin; all others are admin.
  const userCount = await repo.count()
  const role = userCount === 0 ? 'superadmin' : 'admin'

  // Email whitelist (superadmin-controlled). Skipped for the bootstrap user
  // (userCount === 0) so an enabled+empty whitelist can't lock out the app.
  if (userCount > 0) {
    const wl = await getEmailWhitelist()
    if (wl.enabled && !emailMatchesWhitelist(email, wl.patterns)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'This email domain is not allowed to register',
      })
    }
  }

  const trustedUntil = new Date(Date.now() + getTrustWindowMs())
  const user = await repo.save({ email, passwordHash: hashPassword(password), trustedUntil, role })
  await createSession(event, user.id)

  const token = signTrustJwt(user.id, user.email, trustedUntil)
  setTrustCookie(event, token)

  return { user: { id: user.id, email: user.email, role: user.role } }
})
