import { randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { AppDataSource } from './database'
import { MailConfig } from '#server/entities/mailConfig.entity'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface SendMailInput {
  to: string
  subject: string
  body: string
  /** Send `body` as text/html instead of text/plain. */
  html?: boolean
}

/** Patch shape for upserting a user's mail config. `senderPassword` only applies when non-empty. */
export interface MailConfigInput {
  smtpServer?: string
  smtpPort?: number
  useSsl?: boolean
  useTls?: boolean
  usePassword?: boolean
  senderEmail?: string
  senderEmailDisplay?: string
  senderDomain?: string
  senderPassword?: string
  maxLenRecipientEmail?: number
  maxLenSubject?: number
  maxLenBody?: number
  // POST webhook
  provider?: string
  postUrl?: string
  postSchema?: string
  postAuthToken?: string
}

/**
 * The mail/SMTP config is a site-wide setting (superadmin-owned), stored as a
 * single row keyed by this reserved userId (no real user has id 0). Reuses the
 * existing table shape without a schema change.
 */
const SITE_USER_ID = 0

export async function getMailConfig(): Promise<MailConfig | null> {
  return AppDataSource.getRepository(MailConfig).findOneBy({ userId: SITE_USER_ID })
}

/**
 * Upsert the site mail config. `senderPassword` is only overwritten when a
 * non-empty value is supplied, so "save without re-entering the password"
 * leaves the stored secret intact.
 */
export async function saveMailConfig(patch: MailConfigInput): Promise<MailConfig> {
  const repo = AppDataSource.getRepository(MailConfig)
  const existing = await repo.findOneBy({ userId: SITE_USER_ID })
  if (existing) {
    const { senderPassword, ...rest } = patch
    Object.assign(existing, rest)
    if (typeof senderPassword === 'string' && senderPassword !== '') {
      existing.senderPassword = senderPassword
    }
    return repo.save(existing)
  }
  return repo.save(repo.create({ userId: SITE_USER_ID, ...patch }))
}

/** Config safe to return to the client — drops the password, exposes `hasPassword`. */
export function mailConfigToClient(c: MailConfig | null) {
  if (!c) return null
  return {
    id: c.id,
    userId: c.userId,
    smtpServer: c.smtpServer,
    smtpPort: c.smtpPort,
    useSsl: c.useSsl,
    useTls: c.useTls,
    usePassword: c.usePassword,
    senderEmail: c.senderEmail,
    senderEmailDisplay: c.senderEmailDisplay,
    senderDomain: c.senderDomain,
    hasPassword: !!c.senderPassword,
    maxLenRecipientEmail: c.maxLenRecipientEmail,
    maxLenSubject: c.maxLenSubject,
    maxLenBody: c.maxLenBody,
    provider: c.provider,
    postUrl: c.postUrl,
    postSchema: c.postSchema,
    hasPostAuthToken: !!c.postAuthToken,
  }
}

/**
 * From header, ported from smtogo's sender.go. When authenticated the envelope
 * sender must match the SMTP login (sender_email); the display address is shown
 * to the recipient. Unauthenticated senders just use the display address.
 */
function fromAddress(c: MailConfig): string {
  const display = c.senderEmailDisplay.trim()
  if (c.usePassword) {
    return display && display !== c.senderEmail ? `${display} <${c.senderEmail}>` : c.senderEmail
  }
  return display || c.senderEmail
}

function validate(c: MailConfig, input: SendMailInput): void {
  if (!EMAIL_RE.test(input.to)) throw new Error('Invalid recipient email address')
  if (input.to.length > c.maxLenRecipientEmail) {
    throw new Error(`Recipient email exceeds max length (${c.maxLenRecipientEmail})`)
  }
  if (input.subject.length > c.maxLenSubject) {
    throw new Error(`Subject exceeds max length (${c.maxLenSubject})`)
  }
  if (input.body.length > c.maxLenBody) {
    throw new Error(`Body exceeds max length (${c.maxLenBody})`)
  }
}

/** Send via HTTP POST webhook (provider 'post'). Two payload schemas:
 *  smtogo:           { from, to, subject, html }
 *  powerautomate:    { email, content, subject } */
async function sendViaPost(c: MailConfig, input: SendMailInput): Promise<string> {
  if (!c.postUrl) throw new Error('POST webhook URL is not configured')
  validate(c, input)
  const payload =
    c.postSchema === 'powerautomate'
      ? { email: input.to, subject: input.subject, content: input.body }
      : { from: fromAddress(c), to: input.to, subject: input.subject, html: input.body }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (c.postAuthToken) headers.Authorization = `Bearer ${c.postAuthToken}`
  const res = await fetch(c.postUrl, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Webhook returned ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}`)
  }
  return `<post-${randomBytes(8).toString('hex')}@webhook>`
}

/** Send using an explicit config (bypasses the DB lookup). Returns the message id. */
export async function sendMailWithConfig(c: MailConfig, input: SendMailInput): Promise<string> {
  if (c.provider === 'post') return sendViaPost(c, input)
  if (!c.smtpServer) throw new Error('SMTP server is not configured')
  validate(c, input)
  const transporter = nodemailer.createTransport({
    host: c.smtpServer,
    port: c.smtpPort,
    secure: c.useSsl, // implicit TLS (direct socket TLS, e.g. :465)
    requireTLS: c.useTls, // force STARTTLS (e.g. :587/:25)
    auth: c.usePassword ? { user: c.senderEmail, pass: c.senderPassword } : undefined,
  })
  try {
    const info = await transporter.sendMail({
      from: fromAddress(c),
      to: input.to,
      subject: input.subject,
      messageId: c.senderDomain
        ? `<${randomBytes(12).toString('hex')}@${c.senderDomain}>`
        : undefined,
      ...(input.html ? { html: input.body } : { text: input.body }),
    })
    return info.messageId
  } finally {
    transporter.close()
  }
}

/** Send using the site mail config. Returns the message id. */
export async function sendMail(input: SendMailInput): Promise<string> {
  const cfg = await getMailConfig()
  if (!cfg) throw new Error('Mail is not configured')
  return sendMailWithConfig(cfg, input)
}
