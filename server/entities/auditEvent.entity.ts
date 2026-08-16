import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Site-wide audit trail (superadmin-visible). One row per audited action across
 * the whole site — verification attempts, verification-code emails, auth &
 * registration, page lifecycle, membership changes, and superadmin actions — so a
 * superadmin can see "who did what, when, and whether it succeeded" in one place.
 *
 * Retention is configurable (default 90 days; pruned by `pruneOldAuditEvents`).
 *
 * Privacy: visitor identities follow the same stance as `org_events` — names are
 * stored plaintext, while the ID number and IP are kept only as salted SHA-256
 * (in `detail.idHash` / `ipHash`), never raw. Authenticated actors record their
 * `userId` + `email` (both already exist in the `users` table); anonymous actors
 * record the name/email as given on the request.
 */
@Entity({ name: 'audit_events' })
@Index('idx_audit_created', ['createdAt'])
@Index('idx_audit_org', ['pageId', 'createdAt'])
@Index('idx_audit_action', ['action', 'createdAt'])
@Index('idx_audit_user', ['userId', 'createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_audit_events',
  })
  id!: number

  /** Null for site-wide events (login/register/admin-user). */
  @Column({ name: 'page_id', type: 'integer', nullable: true })
  pageId!: number | null

  /** verify | send_code | login | register | password_change | passkey_add | page.create | page.rename | member.add | admin.user_update … */
  @Column({ type: 'text', nullable: false })
  action!: string

  /** 'success' | 'failure', or a richer verify outcome (admitted/not_found/error/missing/mock/trusted). Null when N/A. */
  @Column({ type: 'text', nullable: true })
  outcome!: string | null

  /** 'user' | 'anonymous' | 'system'. */
  @Column({ name: 'actor_type', type: 'text', nullable: true })
  actorType!: string | null

  /** Authenticated actor's user id (null for anonymous visitors). */
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null

  /** Authenticated actor's email, or the recipient for send_code. */
  @Column({ type: 'text', nullable: true })
  email!: string | null

  /** Visitor/target name (e.g. the verify name). */
  @Column({ type: 'text', nullable: true })
  name!: string | null

  /** Salted SHA-256 of the request IP — never raw. */
  @Column({ name: 'ip_hash', type: 'text', nullable: true })
  ipHash!: string | null

  /** Extra structured detail as a JSON string (mode, idHash, oldSlug, newSlug, role, reason, targetUserId…). */
  @Column({ type: 'text', nullable: true })
  detail!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
