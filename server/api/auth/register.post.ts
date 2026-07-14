import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!EMAIL_RE.test(email) || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email or password (min 8 chars)' })
  }

  const existing = useDB().select().from(users).where(eq(users.email, email)).all()
  if (existing.length) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  const id = crypto.randomUUID()
  useDB().insert(users).values({ id, email, passwordHash: hashPassword(password) }).run()
  createSession(event, id)
  return { user: { id, email } }
})
