import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Raw per-org analytics event (90-day retention — pruned by `pruneOldEvents`).
 *
 * Privacy: `name` is stored plaintext (per design); the ID number and visitor IP
 * are stored ONLY as salted SHA-256 hashes (`id_hash`, `ip_hash`) — never raw.
 * `ip_hash` powers unique-visitor dedupe.
 *
 * `type = 'view'` rows come from the public track beacon; `type = 'verify'` rows
 * come from the check handler (one per attempt, with its outcome/mode).
 */
@Entity({ name: 'org_events' })
@Index('idx_org_events_org_time', ['orgId', 'createdAt'])
@Index('idx_org_events_type', ['orgId', 'type', 'createdAt'])
export class OrgEvent {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_events',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  @Column({ type: 'text', nullable: false })
  type!: string // 'view' | 'verify'

  /** verify: admitted | not_found | error | missing | mock | trusted. Null for view. */
  @Column({ type: 'text', nullable: true })
  outcome!: string | null

  /** verify: live | mock | trusted. Null for view. */
  @Column({ type: 'text', nullable: true })
  mode!: string | null

  @Column({ type: 'text', nullable: true })
  name!: string | null

  /** Salted SHA-256 of the normalized ID number — never the raw ID. */
  @Column({ name: 'id_hash', type: 'text', nullable: true })
  idHash!: string | null

  /** Salted SHA-256 of the visitor IP — for unique-visitor dedupe. */
  @Column({ name: 'ip_hash', type: 'text', nullable: true })
  ipHash!: string | null

  @Column({ type: 'text', nullable: true })
  locale!: string | null

  /** Region inferred from the locale suffix (e.g. zh-CN → CN). */
  @Column({ type: 'text', nullable: true })
  country!: string | null

  @Column({ type: 'text', nullable: true })
  device!: string | null

  @Column({ type: 'text', nullable: true })
  browser!: string | null

  @Column({ type: 'text', nullable: true })
  os!: string | null

  @Column({ type: 'text', nullable: true })
  referer!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
