import { Column, Entity, Index, PrimaryGeneratedColumn, type ValueTransformer } from 'typeorm'
import type { ReminderSlot } from '#shared/types'

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

/**
 * A user's per-page reminder-preference override. Keyed by (pageId, userId) — NOT
 * by `org_members.id` — so it covers the page **owner** too, who has no
 * `PageMember` row (ownership lives on `Page.ownerId`).
 *
 * Every column is nullable: a null field inherits downwards (account default →
 * page config → system default). A row existing with all-null fields is
 * equivalent to "use my account default" — the UI writes/destroys the whole row
 * rather than tracking per-field inheritance.
 */
@Entity({ name: 'user_page_notification_prefs' })
@Index('uq_user_org_pref_org_user', ['pageId', 'userId'], { unique: true })
@Index('idx_user_org_pref_user', ['userId'])
export class UserPageNotificationPref {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_user_org_notification_prefs',
  })
  id!: number

  @Column({ name: 'page_id', type: 'integer', nullable: false })
  pageId!: number

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId!: number

  /** null = inherit the account master; true/false = explicit override. */
  @Column({ name: 'notify_expiry', type: 'boolean', nullable: true })
  notifyExpiry!: boolean | null

  /** null = inherit; `[]` = explicit "no reminders". */
  @Column({
    name: 'reminder_slots',
    type: 'text',
    nullable: true,
    transformer: slotArrayTransformer,
  })
  reminderSlots!: ReminderSlot[] | null

  /** null = inherit; otherwise `HH:MM`. */
  @Column({ name: 'reminder_time', type: 'text', nullable: true })
  reminderTime!: string | null
}
