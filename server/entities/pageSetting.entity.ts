import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'page_settings' })
export class PageSetting {
  @PrimaryColumn({ name: 'page_id', type: 'integer', primaryKeyConstraintName: 'pk_org_settings' })
  pageId!: number

  @Column({ type: 'text', nullable: false })
  config!: string

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date
}
