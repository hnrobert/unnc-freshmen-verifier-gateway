import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { signTrustJwt, setTrustCookie, getTrustWindowMs } from '#server/utils/jwt'
import { getEmailWhitelist, emailMatchesWhitelist } from '#server/utils/registration'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: unknown
    password?: unknown
    code?: unknown
    session?: unknown
  }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body?.password ?? '')
  const code = String(body?.code ?? '').trim()
  const session = String(body?.session ?? '').trim()
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

  // Email verification: every non-bootstrap registration must present the code
  // that was emailed for this email+session. Bootstrap (userCount === 0) is
  // exempt — mail may not be configured yet when the first admin sets up.
  if (userCount > 0 && !consumeCode(email, session, code)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired verification code' })
  }

  const trustedUntil = new Date(Date.now() + getTrustWindowMs())
  const user = await repo.save({ email, passwordHash: hashPassword(password), trustedUntil, role })
  await createSession(event, user.id)

  const token = signTrustJwt(user.id, user.email, trustedUntil)
  setTrustCookie(event, token)

  return { user: { id: user.id, email: user.email, role: user.role } }
})
