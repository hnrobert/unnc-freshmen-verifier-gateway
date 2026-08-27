import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import {
  signTrustJwt,
  setTrustCookie,
  getTrustWindowMs,
  EMAIL_TRUST_WINDOW_MS,
} from '#server/utils/jwt'
import { issueTrust } from '#server/utils/trust'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown; trustBrowser?: unknown }>(
    event,
  )
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body?.password ?? '')

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { email } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    void recordAudit(event, {
      action: 'login',
      outcome: 'failure',
      actorType: 'anonymous',
      email,
      detail: { reason: 'invalid_credentials' },
    })
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await createSession(event, user.id)

  void recordAudit(event, {
    action: 'login',
    outcome: 'success',
    actorType: 'user',
    userId: user.id,
    email: user.email,
  })

  const trustedUntil = new Date(Date.now() + getTrustWindowMs())
  await userRepo.update(user.id, { trustedUntil })
  const token = signTrustJwt(user.id, user.email, trustedUntil)
  setTrustCookie(event, token)

  // Optional visitor trust (vg_verify): logging in with a SCHOOL email can
  // mark this browser as verified — the holder of a @nottingham.edu.cn
  // mailbox is exactly who the public pages verify. Grants the 30-day
  // device-bound trust (skip re-verifying) and lists the browser in Settings.
  if (body?.trustBrowser === true && user.email.endsWith('@nottingham.edu.cn')) {
    const prefix = user.email.split('@')[0] ?? user.email
    await issueTrust(event, {
      name: prefix,
      idHash: hashIdNumber(user.email) ?? '',
      deviceHash: deviceHashFromRequest(event),
      admission: { ok: true, admitted: true, message: 'login', name: prefix },
      ttlMs: EMAIL_TRUST_WINDOW_MS,
      trustBrowser: true,
      userId: user.id,
    })
  }

  return { user: { id: user.id, email: user.email, role: user.role } }
})
