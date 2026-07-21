import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Permanent daily rollup of per-org stats (survives the 90-day pruning of
 * `org_events`). EAV-style: one row per (org, day, metric) with a count. Metrics:
 * `view`, `verify_total`, `verify_admitted`, `verify_not_found`, `verify_error`,
 * `verify_missing`, `mock`, `trusted`, `live`. (UV is NOT stored here — it can't
 * be a simple increment; it's computed on read as `COUNT(DISTINCT ip_hash)` from
 * the raw events, within the 90-day window.)
 */
@Entity({ name: 'org_daily_stats' })
@Index('uq_org_daily_stats_day_metric', ['orgId', 'day', 'metric'], { unique: true })
@Index('idx_org_daily_stats_org_day', ['orgId', 'day'])
export class OrgDailyStat {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_daily_stats',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  /** 'YYYY-MM-DD' (UTC). */
  @Column({ type: 'text', nullable: false })
  day!: string

  @Column({ type: 'text', nullable: false })
  metric!: string

  @Column({ type: 'integer', nullable: false, default: 0 })
  count!: number
}
