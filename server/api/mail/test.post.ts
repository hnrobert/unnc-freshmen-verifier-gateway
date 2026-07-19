import { getMailConfig, sendMailWithConfig } from '#server/utils/mail'
import { renderEmail } from '#server/mail/render'

export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ to?: unknown }>(event)
  const to = String(body?.to ?? '').trim()

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured yet' })

  try {
    const html = renderEmail({
      title: 'Test email',
      bodyHtml:
        '<p>This is a test email sent by the UNNC Freshmen Verifier Gateway mail feature.</p>' +
        '<p>If you received it, your SMTP settings are working correctly.</p>',
      preheader: 'Your mail configuration is working.',
    })
    const messageId = await sendMailWithConfig(cfg, {
      to,
      subject: `Mail test from ${cfg.senderEmail || 'UNNC Freshmen Verifier Gateway'}`,
      body: html,
      html: true,
    })
    return { messageId }
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send test email',
    })
  }
})
