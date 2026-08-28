import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'page_poster_settings' })
export class PagePosterSetting {
  @PrimaryColumn({
    name: 'page_id',
    type: 'integer',
    primaryKeyConstraintName: 'pk_page_poster_settings',
  })
  pageId!: number

  @Column({ type: 'text', nullable: false, default: '' })
  title!: string

  @Column({ type: 'text', nullable: false, default: 'page' })
  theme!: string

  @Column({ name: 'font_size', type: 'integer', nullable: false, default: 60 })
  fontSize!: number

  @Column({ type: 'integer', nullable: false, default: 1080 })
  width!: number

  @Column({ type: 'integer', nullable: false, default: 1440 })
  height!: number

  @Column({ type: 'integer', nullable: false, default: 0 })
  border!: number

  @Column({ name: 'border_radius', type: 'integer', nullable: false, default: 28 })
  borderRadius!: number

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date
}
