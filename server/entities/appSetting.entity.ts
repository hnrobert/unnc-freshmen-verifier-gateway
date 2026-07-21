import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Generic key/value store for app-wide settings (not per-org). Each row holds a
 * JSON value under a dotted key, e.g. `registration.emailWhitelist` →
 * `{ enabled, patterns }`. Runtime `synchronize()` creates the table on boot.
 */
@Entity({ name: 'app_settings' })
export class AppSetting {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'pk_app_settings' })
  key!: string

  @Column({ type: 'text', nullable: false, default: '{}' })
  value!: string
}
