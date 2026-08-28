import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { Page } from '#server/entities/page.entity'
import { PageSetting } from '#server/entities/pageSetting.entity'
import { PageImage } from '#server/entities/pageImage.entity'
import { PageMember } from '#server/entities/pageMember.entity'
import { PageEvent } from '#server/entities/pageEvent.entity'
import { PageDailyStat } from '#server/entities/pageDailyStat.entity'
import { PageVerifiedIdentity } from '#server/entities/pageVerifiedIdentity.entity'
import { PageRedirect } from '#server/entities/pageRedirect.entity'
import { PagePosterSetting } from '#server/entities/pagePosterSetting.entity'
import type { SiteConfig } from '#shared/types'
import { resolveImageRefs } from './config'
import { applyDefaults } from '#shared/lib/applyDefaults'

// Slug rules live in #shared/types so the server, redirect middleware, and the
// client (new-page / rename forms) all validate against one source of truth.
export { SLUG_RE, RESERVED_SLUGS, validateSlug } from '#shared/types'

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { t: number; cfg: SiteConfig }>()

export function invalidatePageConfig(slug: string): void {
  cache.delete(slug)
}

export async function loadPageConfig(slug: string): Promise<SiteConfig> {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.cfg

  const page = await AppDataSource.getRepository(Page).findOne({ where: { slug } })
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

  const settings = await AppDataSource.getRepository(PageSetting).findOne({
    where: { pageId: page.id },
  })
  if (!settings) throw createError({ statusCode: 404, statusMessage: 'Page config not found' })

  const raw = JSON.parse(settings.config) as SiteConfig
  // Apply defaults (fill empty strings) so the public page always renders fully.
  const filled = applyDefaults(raw)
  const cfg = await resolveImageRefs(filled, page.slug, page.id)
  cache.set(slug, { t: Date.now(), cfg })
  return cfg
}

/** Look up an page by slug (single query, no cache). For stats/track paths. */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  return AppDataSource.getRepository(Page).findOne({ where: { slug } })
}

export async function deletePageCascade(pageId: number): Promise<void> {
  await AppDataSource.getRepository(PageImage).delete({ pageId })
  await AppDataSource.getRepository(PageSetting).delete({ pageId })
  await AppDataSource.getRepository(PageMember).delete({ pageId })
  await AppDataSource.getRepository(PageEvent).delete({ pageId })
  await AppDataSource.getRepository(PageDailyStat).delete({ pageId })
  await AppDataSource.getRepository(PageVerifiedIdentity).delete({ pageId })
  await AppDataSource.getRepository(PageRedirect).delete({ pageId })
  await AppDataSource.getRepository(PagePosterSetting).delete({ pageId })
  await AppDataSource.getRepository(Page).delete(pageId)
}
