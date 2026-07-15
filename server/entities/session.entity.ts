import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'sessions' })
export class Session {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'pk_sessions' })
  id!: string

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId!: number

  @Column({ name: 'expires_at', type: 'datetime', nullable: false })
  expiresAt!: Date

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
