import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { Organization } from '../entities/organization.entity'
import { OrgSetting } from '../entities/orgSetting.entity'
import { OrgImage } from '../entities/orgImage.entity'
import { OrgMember } from '../entities/orgMember.entity'
import { OrgEvent } from '../entities/orgEvent.entity'
import { OrgDailyStat } from '../entities/orgDailyStat.entity'
import type { SiteConfig } from '../../shared/types'
import { resolveImageRefs } from './config'
import { applyDefaults } from '../../shared/lib/applyDefaults'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/
export const RESERVED_SLUGS = new Set([
  'api',
  'dashboard',
  'login',
  'register',
  'admin',
  'new',
  'www',
  'static',
  'assets',
  '_nuxt',
  'favicon.png',
  'welcome',
])

export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug))
    return 'Slug must be 3-32 chars: lowercase letters, digits, hyphens (no leading/trailing/consecutive hyphens).'
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved.`
  return null
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { t: number; cfg: SiteConfig }>()

export function invalidateOrgConfig(slug: string): void {
  cache.delete(slug)
}

export async function loadOrgConfig(slug: string): Promise<SiteConfig> {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.cfg

  const org = await AppDataSource.getRepository(Organization).findOne({ where: { slug } })
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  const settings = await AppDataSource.getRepository(OrgSetting).findOne({
    where: { orgId: org.id },
  })
  if (!settings)
    throw createError({ statusCode: 404, statusMessage: 'Organization config not found' })

  const raw = JSON.parse(settings.config) as SiteConfig
  // Apply defaults (fill empty strings) so the public page always renders fully.
  const filled = applyDefaults(raw)
  const cfg = await resolveImageRefs(filled, org.slug, org.id)
  cache.set(slug, { t: Date.now(), cfg })
  return cfg
}

/** Look up an org by slug (single query, no cache). For stats/track paths. */
export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  return AppDataSource.getRepository(Organization).findOne({ where: { slug } })
}

export async function deleteOrgCascade(orgId: number): Promise<void> {
  await AppDataSource.getRepository(OrgImage).delete({ orgId })
  await AppDataSource.getRepository(OrgSetting).delete({ orgId })
  await AppDataSource.getRepository(OrgMember).delete({ orgId })
  await AppDataSource.getRepository(OrgEvent).delete({ orgId })
  await AppDataSource.getRepository(OrgDailyStat).delete({ orgId })
  await AppDataSource.getRepository(Organization).delete(orgId)
}
