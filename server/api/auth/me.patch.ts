import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { isValidTz } from '#shared/lib/reminderTz'
import { isValidReminderTime, sanitizeSlots } from '#shared/lib/reminderPref'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{
    email?: unknown
    currentPassword?: unknown
    newPassword?: unknown
    notifyExpiry?: unknown
    tz?: unknown
    reminderSlots?: unknown
    reminderTime?: unknown
    code?: unknown
    session?: unknown
  }>(event)

  const repo = AppDataSource.getRepository(User)
  const fullUser = await repo.findOneBy({ id: user.id })
  if (!fullUser) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // Snapshot before mutation so the audit trail can record the prior email.
  const oldEmail = fullUser.email

  // Email change — validated up front but NOT applied yet. The verification
  // code is consumed as late as possible (just before save) so that a failure
  // in password/notification validation below does not waste a one-shot code.
  const newEmail = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  let pendingEmail: { email: string; session: string; code: string } | null = null
  if (newEmail && newEmail !== fullUser.email) {
    if (!EMAIL_RE.test(newEmail))
      throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
    const existing = await repo.findOneBy({ email: newEmail })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    const session = String(body?.session ?? '').trim()
    const code = String(body?.code ?? '').trim()
    if (!session || !code)
      throw createError({
        statusCode: 400,
        statusMessage: 'A verification code is required to change your email',
      })
    pendingEmail = { email: newEmail, session, code }
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

  // Notification preference (QR-expiry reminder opt-in + account-level default
  // schedule). `null`/`undefined` clears a field back to "inherit".
  if (body.notifyExpiry !== undefined) fullUser.notifyExpiry = !!body.notifyExpiry

  if (body.tz !== undefined) {
    if (body.tz === null || body.tz === '') fullUser.tz = null
    else {
      const tz = String(body.tz)
      if (!isValidTz(tz)) throw createError({ statusCode: 400, statusMessage: 'Invalid timezone' })
      fullUser.tz = tz
    }
  }

  if (body.reminderSlots !== undefined) {
    fullUser.reminderSlots = body.reminderSlots === null ? null : sanitizeSlots(body.reminderSlots)
  }

  if (body.reminderTime !== undefined) {
    if (body.reminderTime === null || body.reminderTime === '') fullUser.reminderTime = null
    else {
      const t = String(body.reminderTime)
      if (!isValidReminderTime(t))
        throw createError({ statusCode: 400, statusMessage: 'Time must be HH:MM (24-hour)' })
      fullUser.reminderTime = t
    }
  }

  // Consume the email-verification code (one-shot) right before persisting, so
  // an invalid/expired code leaves the email unchanged and no other mutation
  // above can waste the code. Only a save failure could now lose it.
  if (pendingEmail) {
    if (!consumeCode(pendingEmail.email, pendingEmail.session, pendingEmail.code))
      throw createError({ statusCode: 400, statusMessage: 'Invalid or expired verification code' })
    fullUser.email = pendingEmail.email
  }

  await repo.save(fullUser)

  if (fullUser.email !== oldEmail) {
    void recordAudit(event, {
      action: 'email_change',
      outcome: 'success',
      actorType: 'user',
      userId: fullUser.id,
      email: fullUser.email,
      detail: { oldEmail, verified: 'email_code' },
    })
  }
  if (String(body?.newPassword ?? '')) {
    void recordAudit(event, {
      action: 'password_change',
      outcome: 'success',
      actorType: 'user',
      userId: fullUser.id,
      email: fullUser.email,
    })
  }

  // Update session user state — just return the new email; the client
  // (useAuth composable) will update useState on the next /api/auth/me call.

  return {
    user: { id: fullUser.id, email: fullUser.email, role: fullUser.role },
    notifyExpiry: fullUser.notifyExpiry,
    tz: fullUser.tz,
    reminderSlots: fullUser.reminderSlots,
    reminderTime: fullUser.reminderTime,
  }
})
