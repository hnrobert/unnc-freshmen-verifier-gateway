import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'org_settings' })
export class OrgSetting {
  @PrimaryColumn({ name: 'org_id', type: 'integer', primaryKeyConstraintName: 'pk_org_settings' })
  orgId!: number

  @Column({ type: 'text', nullable: false })
  config!: string

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date
}
