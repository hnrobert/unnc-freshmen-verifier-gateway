import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

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

  /** Preferred UI / notification locale ('zh' | 'en'). Null until first visit. */
  @Column({ type: 'text', nullable: true })
  locale!: string | null

  /** Opt-in to QR-expiry reminder emails for shared orgs. */
  @Column({ name: 'notify_expiry', type: 'boolean', default: false })
  notifyExpiry!: boolean
}
