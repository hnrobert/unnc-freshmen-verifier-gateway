import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'page_images' })
@Index('uq_org_images_org_key', ['pageId', 'key'], { unique: true })
export class PageImage {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_images',
  })
  id!: number

  @Column({ name: 'page_id', type: 'integer', nullable: false })
  pageId!: number

  @Column({ type: 'text', nullable: false })
  key!: string

  @Column({ type: 'text', nullable: false })
  mime!: string

  @Column({ type: 'text', nullable: false })
  base64!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
