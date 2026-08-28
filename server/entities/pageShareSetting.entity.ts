import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm'
import { Page } from './page.entity'

/** Persisted presentation defaults for Dashboard > Share. */
@Entity({ name: 'page_share_settings' })
export class PageShareSetting {
  @PrimaryColumn({
    name: 'page_id',
    type: 'integer',
    primaryKeyConstraintName: 'pk_page_share_settings',
  })
  pageId!: number

  @OneToOne(() => Page, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id', foreignKeyConstraintName: 'fk_page_share_settings_page' })
  page!: Page

  @Column({ type: 'text', nullable: false, default: '' })
  title!: string

  @Column({ name: 'font_size', type: 'integer', nullable: false, default: 60 })
  fontSize!: number

  @Column({ type: 'integer', nullable: false, default: 480 })
  width!: number

  @Column({ type: 'integer', nullable: false, default: 680 })
  height!: number

  @Column({ name: 'border_width', type: 'integer', nullable: false, default: 0 })
  borderWidth!: number

  @Column({ name: 'border_radius', type: 'integer', nullable: false, default: 12 })
  borderRadius!: number

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date
}
