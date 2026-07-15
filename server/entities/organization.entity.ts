import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'organizations' })
@Index('uq_organizations_slug', ['slug'], { unique: true })
export class Organization {
  @PrimaryGeneratedColumn('increment', { type: 'integer', primaryKeyConstraintName: 'pk_organizations' })
  id!: number

  @Column({ name: 'owner_id', type: 'integer', nullable: false })
  ownerId!: number

  @Column({ type: 'text', nullable: false })
  slug!: string

  @Column({ type: 'text', nullable: false })
  name!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
