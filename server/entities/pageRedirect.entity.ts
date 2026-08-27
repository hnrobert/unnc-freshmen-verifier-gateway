import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Maps a retired page slug → the page that last held it, so the old-slug redirect
 * middleware can send visitors from an old public URL to that page's CURRENT
 * slug. A row lives until either the page is deleted (deletePageCascade) or a new
 * page claims the slug (page create/rename frees it). The middleware resolves the
 * stored pageId to the page's live slug at request time, so a redirect keeps
 * pointing at the right place across subsequent renames automatically.
 */
@Entity({ name: 'page_redirects' })
export class PageRedirect {
  @PrimaryColumn({ name: 'old_slug', type: 'text' })
  oldSlug!: string

  @Column({ name: 'page_id', type: 'integer' })
  pageId!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date
}
