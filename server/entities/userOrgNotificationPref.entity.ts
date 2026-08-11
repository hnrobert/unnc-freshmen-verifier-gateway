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
 * A user's per-org reminder-preference override. Keyed by (orgId, userId) — NOT
 * by `org_members.id` — so it covers the org **owner** too, who has no
 * `OrgMember` row (ownership lives on `Organization.ownerId`).
 *
 * Every column is nullable: a null field inherits downwards (account default →
 * org config → system default). A row existing with all-null fields is
 * equivalent to "use my account default" — the UI writes/destroys the whole row
 * rather than tracking per-field inheritance.
 */
@Entity({ name: 'user_org_notification_prefs' })
@Index('uq_user_org_pref_org_user', ['orgId', 'userId'], { unique: true })
@Index('idx_user_org_pref_user', ['userId'])
export class UserOrgNotificationPref {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_user_org_notification_prefs',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

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
