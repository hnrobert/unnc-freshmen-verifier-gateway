import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * A verified visitor identity, scoped per page — the permanent "has this name +
 * ID already verified for this page" index used to fast-path returning members
 * without re-querying the UNNC portal.
 *
 * Privacy: only the **salted SHA-256** of the normalized ID number is stored
 * (`id_hash`) — never the raw ID. `name` is kept plaintext (consistent with
 * `org_events.name`) so the welcome page can greet a returning visitor.
 *
 * Unlike `org_events` (90-day retention), this table is permanent so a one-time
 * verification dedupes for the page's lifetime. Unique on `(org_id, id_hash)` —
 * one identity per page.
 */
@Entity({ name: 'org_verified_identities' })
@Index('idx_org_verified_identity_org_hash', ['pageId', 'idHash'], { unique: true })
export class PageVerifiedIdentity {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_org_verified_identities',
  })
  id!: number

  @Column({ name: 'org_id', type: 'integer', nullable: false })
  pageId!: number

  @Column({ type: 'text', nullable: false })
  name!: string

  /** Salted SHA-256 of the normalized ID number — never the raw ID. */
  @Column({ name: 'id_hash', type: 'text', nullable: false })
  idHash!: string

  @Column({ name: 'verified_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  verifiedAt!: Date
}
