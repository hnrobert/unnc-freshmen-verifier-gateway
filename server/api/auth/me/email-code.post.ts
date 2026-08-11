import { randomInt } from 'node:crypto'
import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { renderEmail } from '#server/mail/render'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Send a 6-digit verification code to a *new* email address the logged-in user
 * wants to switch to. Authenticated self-service — unlike the anonymous
 * registration `send-code`, a clear 400/409 is returned for "already yours" /
 * "taken by someone else" (no anti-enumeration silent-OK here, since the caller
 * is known). The code is later consumed by `PATCH /api/auth/me` when the email
 * actually changes.
 *
 * - Per-sender rate limit via checkAccountSend (6/min, 24/day).
 * - Requires mail to be configured (400 otherwise).
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const body = await readBody<{ newEmail?: unknown; session?: unknown }>(event)
  const newEmail = String(body?.newEmail ?? '')
    .trim()
    .toLowerCase()
  const session = String(body?.session ?? '').trim()
  if (!EMAIL_RE.test(newEmail))
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  if (!session) throw createError({ statusCode: 400, statusMessage: 'Missing session' })
  if (newEmail === me.email)
    throw createError({ statusCode: 400, statusMessage: 'This is already your email' })

  const repo = AppDataSource.getRepository(User)
  const existing = await repo.findOneBy({ email: newEmail })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already in use' })

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured' })

  const limit = checkAccountSend(me.id)
  if (!limit.allowed) throw createError(emailLimitError(limit))

  const code = String(randomInt(100000, 1000000))
  issueCode(newEmail, session, code)

  const html = renderEmail({
    title: 'Confirm your new email',
    bodyHtml:
      // Lead/hint <p> inherit `.body-ink`; the code uses `.ink` so it stays
      // readable in both light and dark themes (template `!important` overrides).
      '<p style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">' +
      `Use this code to confirm <strong>${newEmail}</strong> as the new email address for your account:</p>` +
      `<p class="ink" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#0a0a0a;margin:16px 0;">${code}</p>` +
      '<p class="muted" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#737373;">This code expires in 10 minutes. If you did not request this change, you can safely ignore this email.</p>',
    preheader: `Your email confirmation code is ${code}`,
  })

  try {
    await sendMailWithConfig(cfg, {
      to: newEmail,
      subject: 'Confirm your new email address',
      body: html,
      html: true,
    })
  } catch (e) {
    void recordAudit(event, {
      action: 'send_code',
      outcome: 'failure',
      actorType: 'user',
      userId: me.id,
      email: me.email,
      detail: {
        purpose: 'email_change',
        targetEmail: newEmail,
        reason: e instanceof Error ? e.message : 'send_failed',
      },
    })
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send code',
    })
  }

  void recordAudit(event, {
    action: 'send_code',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    detail: { purpose: 'email_change', targetEmail: newEmail },
  })
  return { ok: true, warning: limit.warning }
})
