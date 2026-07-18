import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * A registered WebAuthn credential (a "passkey") for a user. One user may have
 * many passkeys (one per device). The credential id (base64url) is the lookup
 * key during discoverable login — it's globally unique across all users.
 *
 * `public_key` is the SPKI public key bytes; stored as a blob (better-sqlite3
 * returns a Buffer, converted to Uint8Array on read for SimpleWebAuthn).
 */
@Entity({ name: 'passkeys' })
@Index('uq_passkeys_credential_id', ['credentialId'], { unique: true })
@Index('idx_passkeys_user', ['userId'])
export class Passkey {
  @PrimaryGeneratedColumn('increment', { type: 'integer', primaryKeyConstraintName: 'pk_passkeys' })
  id!: number

  @Column({ name: 'credential_id', type: 'text', nullable: false })
  credentialId!: string

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId!: number

  /** SPKI public key bytes. Stored as blob → Buffer (sqlite) → Uint8Array on read. */
  @Column({ name: 'public_key', type: 'blob', nullable: false })
  publicKey!: Buffer

  @Column({ type: 'integer', nullable: false, default: 0 })
  counter!: number

  /** JSON.stringify(AuthenticatorTransportFuture[]) — helps the browser pick a credential. */
  @Column({ type: 'text', nullable: true })
  transports!: string | null

  /** 'singleDevice' | 'multiDevice'. */
  @Column({ name: 'device_type', type: 'text', nullable: true })
  deviceType!: string | null

  @Column({ name: 'backed_up', type: 'boolean', nullable: false, default: false })
  backedUp!: boolean

  /** User-facing label, e.g. "MacBook". */
  @Column({ type: 'text', nullable: true })
  nickname!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
