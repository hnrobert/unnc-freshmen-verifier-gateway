import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Tracks which QR-expiry reminder emails have already been sent for an org, so
 * the scheduler never resends. Lives in its own table (not in the org's config
 * JSON) because the dashboard config PUT replaces the whole JSON wholesale and
 * would wipe any sent-flag stored there.
 *
 * Keyed on (orgId, expiresAt, kind): a fresh welcome image with a new expiry
 * date gets fresh send slots automatically, and the unique constraint makes
 * sending idempotent even under races / restarts.
 */
export type ReminderKind = 'day-before' | 'day-of'

@Entity({ name: 'org_reminder_sents' })
@Index('uq_org_reminder_org_date_kind', ['orgId', 'expiresAt', 'kind'], { unique: true })
export class OrgReminderSent {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_reminder_sents',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  /** 'YYYY-MM-DD' — the expiry this reminder belongs to (matches config.welcome.expiresAt). */
  @Column({ name: 'expires_at', type: 'text', nullable: false })
  expiresAt!: string

  /** 'day-before' = noon the day before expiry; 'day-of' = 08:00 on expiry day. */
  @Column({ type: 'text', nullable: false })
  kind!: ReminderKind

  @Column({ name: 'sent_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sentAt!: Date
}
