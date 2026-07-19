import { getMailConfig, sendMailWithConfig } from '#server/utils/mail'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{ to?: unknown }>(event)
  const to = String(body?.to ?? '').trim()

  const cfg = await getMailConfig(user.id)
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured yet' })

  try {
    const messageId = await sendMailWithConfig(cfg, {
      to,
      subject: `Mail test from ${cfg.senderEmail || 'UNNC VG'}`,
      body:
        'This is a test email sent by the UNNC Freshmen Verifier Gateway mail feature.\n\n' +
        'If you received it, your SMTP settings are working.',
    })
    return { messageId }
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send test email',
    })
  }
})
