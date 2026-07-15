import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'verifications' })
@Index('idx_verifications_user', ['userId'])
export class Verification {
  @PrimaryGeneratedColumn('increment', { type: 'integer', primaryKeyConstraintName: 'pk_verifications' })
  id!: number

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId!: number

  @Column({ name: 'org_slug', type: 'text', nullable: false })
  orgSlug!: string

  @Column({ type: 'text', nullable: false })
  name!: string

  @Column({ name: 'id_number', type: 'text', nullable: false })
  idNumber!: string

  @Column({ name: 'verified_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  verifiedAt!: Date
}
