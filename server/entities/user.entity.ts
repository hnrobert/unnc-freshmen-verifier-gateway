import { Column, Entity, Index, PrimaryGeneratedColumn, type ValueTransformer } from 'typeorm'
import type { ReminderSlot } from '#shared/types'

/** `ReminderSlot[] | null` ↔ JSON-in-text for SQLite (which has no JSON type). */
const slotArrayTransformer: ValueTransformer = {
  from(value: string | null): ReminderSlot[] | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as ReminderSlot[]) : null
    } catch {
      return null
    }
  },
  to(value: ReminderSlot[] | null): string | null {
    return value == null ? null : JSON.stringify(value)
  },
}

@Entity({ name: 'users' })
@Index('uq_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'integer', primaryKeyConstraintName: 'pk_users' })
  id!: number

  @Column({ type: 'text', nullable: false })
  email!: string

  @Column({ name: 'password_hash', type: 'text', nullable: false })
  passwordHash!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date

  @Column({ name: 'trusted_until', type: 'datetime', nullable: true })
  trustedUntil!: Date | null

  @Column({ type: 'text', default: 'admin' })
  role!: string

  /**
   * Per-user cap on the number of organizations this account can create.
   * `null` = fall back to the default admin limit (see DEFAULT_ADMIN_PAGE_LIMIT).
   * Superadmins are always unlimited regardless of this value. Configured by a
   * superadmin from the Users panel.
   */
  @Column({ name: 'org_limit', type: 'integer', nullable: true })
  pageLimit!: number | null

  /** Preferred UI / notification locale ('zh' | 'en'). Null until first visit. */
  @Column({ type: 'text', nullable: true })
  locale!: string | null

  /** Opt-in to QR-expiry reminder emails (default on; users can turn it off). */
  @Column({ name: 'notify_expiry', type: 'boolean', default: true })
  notifyExpiry!: boolean

  /** IANA timezone in which this user's reminder `reminderTime` fires. Null until
   * first set (the dashboard auto-detects from the browser); resolved downwards
   * to the page's tz, then the server's. */
  @Column({ type: 'text', nullable: true })
  tz!: string | null

  /** Account-level default reminder slots; null = "not personalized" (inherit
   * the page config / system default). `[]` is an explicit "no reminders". */
  @Column({
    name: 'reminder_slots',
    type: 'text',
    nullable: true,
    transformer: slotArrayTransformer,
  })
  reminderSlots!: ReminderSlot[] | null

  /** Account-level default time-of-day (`HH:MM`) for reminder slots; null = inherit. */
  @Column({ name: 'reminder_time', type: 'text', nullable: true })
  reminderTime!: string | null
}
