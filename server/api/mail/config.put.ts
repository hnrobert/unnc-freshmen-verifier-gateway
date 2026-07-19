import { saveMailConfig, mailConfigToClient, type MailConfigInput } from '#server/utils/mail'

const clampInt = (v: unknown, fallback: number, min = 1, max = 65535): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<Record<string, unknown>>(event)

  const patch: MailConfigInput = {
    smtpServer: typeof body?.smtpServer === 'string' ? body.smtpServer.trim() : '',
    smtpPort: clampInt(body?.smtpPort, 587, 1, 65535),
    useSsl: Boolean(body?.useSsl),
    useTls: Boolean(body?.useTls),
    usePassword: Boolean(body?.usePassword),
    senderEmail: typeof body?.senderEmail === 'string' ? body.senderEmail.trim() : '',
    senderEmailDisplay:
      typeof body?.senderEmailDisplay === 'string' ? body.senderEmailDisplay.trim() : '',
    senderDomain: typeof body?.senderDomain === 'string' ? body.senderDomain.trim() : '',
    maxLenRecipientEmail: clampInt(body?.maxLenRecipientEmail, 64, 1, 1024),
    maxLenSubject: clampInt(body?.maxLenSubject, 255, 1, 10000),
    maxLenBody: clampInt(body?.maxLenBody, 50000, 1, 1_000_000),
  }
  // Password only updated when a non-empty string is supplied.
  if (typeof body?.senderPassword === 'string' && body.senderPassword !== '') {
    patch.senderPassword = body.senderPassword
  }

  if (!patch.smtpServer) {
    throw createError({ statusCode: 400, statusMessage: 'SMTP server is required' })
  }

  const saved = await saveMailConfig(user.id, patch)
  return mailConfigToClient(saved)
})
