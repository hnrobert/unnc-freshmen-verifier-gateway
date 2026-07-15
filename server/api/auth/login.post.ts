import { AppDataSource } from '../../utils/database'
import { User } from '../../entities/user.entity'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  const user = await AppDataSource.getRepository(User).findOne({ where: { email } })
  if (!user || !verifyPassword(password, user.passwordHash))
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  await createSession(event, user.id)
  return { user: { id: user.id, email: user.email } }
})
