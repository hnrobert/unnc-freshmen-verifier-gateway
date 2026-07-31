import { getMailConfig, sendMailWithConfig } from '#server/utils/mail'
import { renderEmail } from '#server/mail/render'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const me = requireSuperAdmin(event)
  const body = await readBody<{ to?: unknown }>(event)
  const to = String(body?.to ?? '')
    .trim()
    .toLowerCase()
  if (!EMAIL_RE.test(to))
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipient email' })

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured yet' })

  // Rate limits: per sender account (6/min, 24/day) + per recipient (1/min, 10/day).
  const accountLimit = checkAccountSend(me.id)
  if (!accountLimit.allowed) throw createError(emailLimitError(accountLimit))
  const targetLimit = checkEmailSend('test', to)
  if (!targetLimit.allowed) throw createError(emailLimitError(targetLimit))

  try {
    const html = renderEmail({
      title: 'Test email',
      bodyHtml:
        '<p>This is a test email sent by the UNNC Freshmen Verifier Gateway mail feature.</p>' +
        '<p>If you received it, your Mail settings are working correctly.</p>',
      preheader: 'Your mail configuration is working.',
    })
    const messageId = await sendMailWithConfig(cfg, {
      to,
      subject: `Mail test from ${cfg.senderEmail || 'UNNC Freshmen Verifier Gateway'}`,
      body: html,
      html: true,
    })
    const warning =
      [accountLimit.warning, targetLimit.warning].filter(Boolean).join(' ') || undefined
    return { messageId, warning }
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send test email',
    })
  }
})
