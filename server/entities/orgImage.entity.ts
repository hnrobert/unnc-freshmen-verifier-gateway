import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'org_images' })
@Index('uq_org_images_org_key', ['orgId', 'key'], { unique: true })
export class OrgImage {
  @PrimaryGeneratedColumn('increment', { type: 'integer', primaryKeyConstraintName: 'pk_org_images' })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  @Column({ type: 'text', nullable: false })
  key!: string

  @Column({ type: 'text', nullable: false })
  mime!: string

  @Column({ type: 'text', nullable: false })
  base64!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
