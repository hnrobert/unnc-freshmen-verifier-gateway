import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  const u = useDB().select().from(users).where(eq(users.email, email)).all()[0]
  if (!u || !verifyPassword(password, u.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  createSession(event, u.id)
  return { user: { id: u.id, email: u.email } }
})
