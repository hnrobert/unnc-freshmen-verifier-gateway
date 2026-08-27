import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Server-side registry of browser-trust grants (the vg_verify cookie's
 * bookkeeping). One row per device fingerprint (vg_device cookie + User-Agent
 * hash): written whenever a verify issues/renews a trust cookie, listed in
 * Settings → Trusted browsers, and revoked per-device from there.
 *
 * `userId` is the account that happened to be signed in when the trust was
 * earned — Settings lists that account's devices. Anonymous earns (no
 * vg_session) keep userId null and are managed only from the earning browser.
 * A revoked row makes the device's vg_verify cookie inert everywhere (the
 * public /trust check and the check bypass consult this table); re-verifying
 * on that device clears the revocation.
 */
@Entity({ name: 'trust_grants' })
@Index('uq_trust_grants_device', ['deviceHash'], { unique: true })
@Index('idx_trust_grants_user', ['userId'])
export class TrustGrant {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_trust_grants',
  })
  id!: number

  /** Salted hash of (vg_device cookie + User-Agent) — same value bound into the JWT. */
  @Column({ name: 'device_hash', type: 'text', nullable: false })
  deviceHash!: string

  /** Signed-in user when the trust was earned; null for anonymous earns. */
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null

  /** Verified visitor name (or email prefix) the trust is bound to. */
  @Column({ type: 'text', nullable: false })
  name!: string

  /** User-Agent snapshot for device display ("Chrome on macOS"). */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null

  @Column({ name: 'trusted_until', type: 'datetime', nullable: false })
  trustedUntil!: Date

  @Column({ name: 'last_refreshed_at', type: 'datetime', nullable: false })
  lastRefreshedAt!: Date

  /** Non-null once revoked from Settings — the device's cookie stops working. */
  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt!: Date | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
