import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Maps a retired org slug → the org that last held it, so the old-slug redirect
 * middleware can send visitors from an old public URL to that org's CURRENT
 * slug. A row lives until either the org is deleted (deleteOrgCascade) or a new
 * org claims the slug (org create/rename frees it). The middleware resolves the
 * stored orgId to the org's live slug at request time, so a redirect keeps
 * pointing at the right place across subsequent renames automatically.
 */
@Entity({ name: 'org_redirects' })
export class OrgRedirect {
  @PrimaryColumn({ name: 'old_slug', type: 'text' })
  oldSlug!: string

  @Column({ name: 'org_id', type: 'integer' })
  orgId!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
