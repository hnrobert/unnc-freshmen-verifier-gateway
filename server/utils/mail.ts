import { randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { EmailPoster, PRESETS, type FieldMap } from 'email-poster'
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
  /** email-poster FieldMap JSON (logical field → downstream key). '' = derive from post_schema. */
  postFieldMap?: string
  /** email-poster PostSchema[] JSON — the editor's post-schemas library. '' = never stored. */
  postSchemas?: string
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
    postFieldMap: c.postFieldMap,
    postSchemas: c.postSchemas,
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
}

/**
 * Resolve the effective email-poster FieldMap for a config. The stored
 * `post_field_map` JSON is authoritative when present; otherwise migrate from
 * the legacy `post_schema` discriminator ('powerautomate' → custom_example,
 * i.e. {email, subject, content}; otherwise smtogo's {from, to, subject, html}).
 * Malformed JSON falls back to the migration path so a corrupt row never blocks
 * sending.
 */
function resolveFieldMapFromConfig(c: MailConfig): FieldMap {
  const raw = c.postFieldMap?.trim()
  if (raw) {
    try {
      return JSON.parse(raw) as FieldMap
    } catch {
      // fall through to legacy migration
    }
  }
  return c.postSchema === 'powerautomate' ? PRESETS.custom_example : PRESETS.smtogo
}

/**
 * Send via an HTTP POST webhook through email-poster. The field map is fully
 * editable from the admin UI; the two legacy shapes (smtogo / Custom Example)
 * are the presets / migration defaults, so payloads are byte-identical to the
 * previous hand-rolled implementation.
 *
 * Wire-compat is deliberately pinned — do NOT relax without auditing all call
 * sites: `retry.maxAttempts: 1` (legacy was a single fetch with no retry) and
 * `parseMessageId: false` (legacy synthesized `<post-<hex>@webhook>` without
 * reading the response body). Both reproduce the old on-the-wire behavior.
 */
async function sendViaPost(c: MailConfig, input: SendMailInput): Promise<string> {
  if (!c.postUrl) throw new Error('POST webhook URL is not configured')
  validate(c, input)
  const poster = new EmailPoster({
    postUrl: c.postUrl,
    preset: 'none',
    fields: resolveFieldMapFromConfig(c),
    fromAddress: fromAddress(c),
    headers: c.postAuthToken ? { Authorization: `Bearer ${c.postAuthToken}` } : {},
    // Legacy parity: one attempt (no retry), always-synthesized message id.
    retry: { maxAttempts: 1 },
    recipients: { serialize: 'comma' },
    parseMessageId: false,
    // The library's own caps default to maxLenBody 50 000 — welcome emails
    // embed a base64 image and run into hundreds of KB, so the default rejects
    // them with "Validation failed". Pass the admin-configured limits, with a
    // deliberately huge body ceiling: the hand-rolled implementation this
    // replaced had no body cap, and our own validate() doesn't check body
    // length either (per-product decision).
    limits: {
      maxLenRecipientEmail: c.maxLenRecipientEmail,
      maxLenSubject: c.maxLenSubject,
      maxLenBody: 100_000_000,
    },
  })
  try {
    const { messageId } = await poster.send({
      to: input.to,
      subject: input.subject,
      body: input.body,
      type: input.html ? 'html' : 'text',
    })
    return messageId
  } catch (e) {
    // email-poster already formats HTTP failures as "Webhook returned <status>:
    // <detail>"; surface that message verbatim, fall back for non-Error throws.
    throw new Error(e instanceof Error ? e.message : 'Webhook send failed')
  }
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
