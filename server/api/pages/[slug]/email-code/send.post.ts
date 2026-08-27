import { randomInt } from 'node:crypto'
import { renderEmail } from '#server/mail/render'
import { getVerificationSettings } from '#server/utils/verification'

/**
 * Public (code mode): send a 6-digit verification code to a
 * @nottingham.edu.cn address. Same in-memory store / one-shot / 5-attempt
 * semantics as the registration flow (see server/utils/emailCode.ts), scoped
 * by a client-chosen `session` token so concurrent tabs don't collide.
 * Rate-limited per-recipient (1/min, 10/day).
 */
export default defineEventHandler(async (event) => {
  const settings = await getVerificationSettings()
  if (!settings.emailModes.includes('code'))
    throw createError({ statusCode: 403, statusMessage: 'Code flow is not enabled' })

  const body = await readBody<{ email?: unknown; session?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const session = String(body?.session ?? '').trim()

  if (!email.endsWith('@nottingham.edu.cn'))
    throw createError({
      statusCode: 400,
      statusMessage: 'Only @nottingham.edu.cn emails are allowed',
    })
  if (isDisallowedEmail(email))
    throw createError({ statusCode: 403, statusMessage: 'This email address is not allowed' })
  if (!session) throw createError({ statusCode: 400, statusMessage: 'session is required' })

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured' })

  const limit = checkEmailSend('code', email)
  if (!limit.allowed) {
    const e = emailLimitError(limit)
    throw createError(e)
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  issueCode(email, session, code)

  const html = renderEmail({
    title: 'Your verification code',
    bodyHtml: `<p style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:28px;letter-spacing:8px;font-weight:700;margin:0 0 12px;">${code}</p><p style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#737373;margin:0;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>`,
  })
  try {
    await sendMailWithConfig(cfg, {
      to: email,
      subject: 'Your verification code',
      body: html,
      html: true,
    })
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send email',
    })
  }

  return { ok: true, warning: limit.warning }
})
