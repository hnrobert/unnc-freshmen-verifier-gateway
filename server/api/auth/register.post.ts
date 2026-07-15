import { AppDataSource } from '../../utils/database'
import { User } from '../../entities/user.entity'

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

  const user = await repo.save({ email, passwordHash: hashPassword(password) })
  await createSession(event, user.id)
  return { user: { id: user.id, email: user.email } }
})
