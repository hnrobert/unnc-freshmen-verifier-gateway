import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{
    email?: unknown
    currentPassword?: unknown
    newPassword?: unknown
  }>(event)

  const repo = AppDataSource.getRepository(User)
  const fullUser = await repo.findOneBy({ id: user.id })
  if (!fullUser) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // Email change
  const newEmail = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  if (newEmail && newEmail !== fullUser.email) {
    if (!EMAIL_RE.test(newEmail))
      throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
    const existing = await repo.findOneBy({ email: newEmail })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    fullUser.email = newEmail
  }

  // Password change (requires current password)
  const newPassword = String(body?.newPassword ?? '')
  if (newPassword) {
    if (newPassword.length < 8)
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters',
      })
    const currentPassword = String(body?.currentPassword ?? '')
    if (!verifyPassword(currentPassword, fullUser.passwordHash))
      throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
    fullUser.passwordHash = hashPassword(newPassword)
  }

  await repo.save(fullUser)

  // Update session user state — just return the new email; the client
  // (useAuth composable) will update useState on the next /api/auth/me call.

  return { user: { id: fullUser.id, email: fullUser.email, role: fullUser.role } }
})
