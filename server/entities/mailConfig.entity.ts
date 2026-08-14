import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Per-user SMTP/sender config (one row per user — so different users can send
 * from different mailboxes).
 *  - SMTP server: smtp_server / smtp_port / use_ssl (implicit TLS, :465) /
 *    use_tls (STARTTLS) / use_password (auth on/off).
 *  - Sender: sender_email (SMTP login + envelope From), sender_email_display
 *    (From display, falls back to sender_email), sender_domain (Message-ID),
 *    sender_password.
 *  - Limits: max_len_recipient_email / max_len_subject / max_len_body.
 *
 * `sender_password` is stored as given; the API never returns
 * it — only `hasPassword`.
 */
@Entity({ name: 'mail_configs' })
@Index('uq_mail_configs_user', ['userId'], { unique: true })
export class MailConfig {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_mail_configs',
  })
  id!: number

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId!: number

  // --- SMTP server ---
  @Column({ name: 'smtp_server', type: 'text', default: '' })
  smtpServer!: string

  @Column({ name: 'smtp_port', type: 'integer', default: 587 })
  smtpPort!: number

  /** Implicit TLS (direct socket TLS, typically port 465). */
  @Column({ name: 'use_ssl', type: 'boolean', default: false })
  useSsl!: boolean

  /** Upgrade via STARTTLS (typically port 587/25). */
  @Column({ name: 'use_tls', type: 'boolean', default: true })
  useTls!: boolean

  /** Authenticate with sender_email / sender_password. */
  @Column({ name: 'use_password', type: 'boolean', default: true })
  usePassword!: boolean

  // --- Sender ---
  @Column({ name: 'sender_email', type: 'text', default: '' })
  senderEmail!: string

  @Column({ name: 'sender_email_display', type: 'text', default: '' })
  senderEmailDisplay!: string

  @Column({ name: 'sender_domain', type: 'text', default: '' })
  senderDomain!: string

  @Column({ name: 'sender_password', type: 'text', default: '' })
  senderPassword!: string

  // --- Limits ---
  @Column({ name: 'max_len_recipient_email', type: 'integer', default: 64 })
  maxLenRecipientEmail!: number

  @Column({ name: 'max_len_subject', type: 'integer', default: 255 })
  maxLenSubject!: number

  @Column({ name: 'max_len_body', type: 'integer', default: 50000 })
  maxLenBody!: number

  // --- POST webhook (provider === 'post') ---
  @Column({ type: 'text', default: 'smtp' })
  provider!: string // 'smtp' | 'post'

  @Column({ name: 'post_url', type: 'text', default: '' })
  postUrl!: string

  @Column({ name: 'post_schema', type: 'text', default: 'smtogo' })
  postSchema!: string // 'smtogo' | 'powerautomate'

  @Column({ name: 'post_auth_token', type: 'text', default: '' })
  postAuthToken!: string

  /**
   * email-poster FieldMap as JSON (logical field → downstream key), edited by the
   * visual interface editor. When empty, the effective map is derived from
   * `post_schema` for backward compatibility ('powerautomate' → custom_example
   * preset, otherwise smtogo). Once non-empty, this column is authoritative.
   */
  @Column({ name: 'post_field_map', type: 'text', default: '' })
  postFieldMap!: string

  /**
   * The post-schemas library (email-poster `PostSchema[]`) as JSON — the named
   * field maps the operator switches between / adds / renames / deletes in the
   * editor. Stored server-side (shared across admins, not per-browser). The
   * active webhook format is `post_field_map`; this is the palette behind it.
   * Empty string = never stored (the editor seeds the built-in defaults on first
   * use and persists them here); `'[]'` = explicitly cleared (stays empty).
   */
  @Column({ name: 'post_schemas', type: 'text', default: '' })
  postSchemas!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date

  @Column({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date
}
