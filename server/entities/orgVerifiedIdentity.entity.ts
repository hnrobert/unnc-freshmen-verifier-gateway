import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * A verified visitor identity, scoped per org — the permanent "has this name +
 * ID already verified for this org" index used to fast-path returning members
 * without re-querying the UNNC portal.
 *
 * Privacy: only the **salted SHA-256** of the normalized ID number is stored
 * (`id_hash`) — never the raw ID. `name` is kept plaintext (consistent with
 * `org_events.name`) so the welcome page can greet a returning visitor.
 *
 * Unlike `org_events` (90-day retention), this table is permanent so a one-time
 * verification dedupes for the org's lifetime. Unique on `(org_id, id_hash)` —
 * one identity per org.
 */
@Entity({ name: 'org_verified_identities' })
@Index('idx_org_verified_identity_org_hash', ['orgId', 'idHash'], { unique: true })
export class OrgVerifiedIdentity {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_verified_identities',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  orgId!: number

  @Column({ type: 'text', nullable: false })
  name!: string

  /** Salted SHA-256 of the normalized ID number — never the raw ID. */
  @Column({ name: 'id_hash', type: 'text', nullable: false })
  idHash!: string

  @Column({ name: 'verified_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  verifiedAt!: Date
}
