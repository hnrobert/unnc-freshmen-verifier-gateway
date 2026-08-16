import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { ReminderSlot } from '#shared/types'

/**
 * Tracks which QR-expiry reminder emails have already been sent for an page, so
 * the scheduler never resends. Lives in its own table (not in the page's config
 * JSON) because the dashboard config PUT replaces the whole JSON wholesale and
 * would wipe any sent-flag stored there.
 *
 * Keyed on (pageId, userId, expiresAt, kind): schedules are per-user (each
 * person has their own timezone/schedule), so the same slot can fire for many
 * users of one page. A fresh welcome image with a new expiry date gets fresh
 * send slots automatically, and the unique constraint makes sending idempotent
 * even under races / restarts. (The legacy 3-column index from the page-centric
 * era is dropped once by `03.reminders-migration.ts`.)
 */
@Entity({ name: 'page_reminder_sents' })
@Index('uq_org_reminder_org_user_date_kind', ['pageId', 'userId', 'expiresAt', 'kind'], {
  unique: true,
})
export class PageReminderSent {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_reminder_sents',
  })
  id!: number

  @Column({ name: 'page_id', type: 'integer', nullable: false })
  pageId!: number

  /** The recipient this send belongs to (schedules are per-user). Nullable at
   * the DB level only so `synchronize` can add the column to a populated table;
   * app code always sets it, and legacy null rows are truncated at cutover. */
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number

  /** 'YYYY-MM-DD' — the expiry this reminder belongs to (matches config.welcome.expiresAt). */
  @Column({ name: 'expires_at', type: 'text', nullable: false })
  expiresAt!: string

  /** Which reminder slot was sent — a ReminderSlot ('-3d' | '-2d' | '-1d' | 'day-of'). */
  @Column({ type: 'text', nullable: false })
  kind!: ReminderSlot

  @Column({ name: 'sent_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sentAt!: Date
}
