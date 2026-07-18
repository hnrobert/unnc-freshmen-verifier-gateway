import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * A shared-access membership on an org. Rows are created as **invites**
 * (`status = 'pending'`, `user_id = null`, `invite_token` set); when the recipient
 * claims the link, `user_id`/`accepted_at` are set, `status = 'active'`, and the
 * token is cleared.
 *
 * Roles: `viewer` (read config + stats) < `editor` (edit config/images) <
 * `manager` (also manage members). The org owner is not stored here — ownership
 * lives on `Organization.ownerId`; superadmins bypass entirely.
 */
@Entity({ name: 'org_members' })
@Index('uq_org_members_org_email', ['orgId', 'invitedEmail'], { unique: true })
@Index('uq_org_members_token', ['inviteToken'], { unique: true })
@Index('idx_org_members_org', ['orgId'])
@Index('idx_org_members_user', ['userId'])
export class OrgMember {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_members',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  /** Null until the invite is claimed. */
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null

  @Column({ name: 'invited_email', type: 'text', nullable: false })
  invitedEmail!: string

  /** High-entropy hex token; null once claimed. Unique (multiple NULLs allowed). */
  @Column({ name: 'invite_token', type: 'text', nullable: true })
  inviteToken!: string | null

  @Column({ type: 'text', nullable: false })
  role!: string // 'viewer' | 'editor' | 'manager'

  @Column({ type: 'text', nullable: false, default: 'pending' })
  status!: string // 'pending' | 'active'

  @Column({ name: 'invited_by', type: 'integer', nullable: false })
  invitedBy!: number

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt!: Date | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date

  @Column({ name: 'accepted_at', type: 'datetime', nullable: true })
  acceptedAt!: Date | null
}
