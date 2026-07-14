import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { organizations, orgSettings } from '../db/schema'
import type { SiteConfig } from '../../shared/types'
import { resolveImageRefs } from './config'

/** 3–32 chars, lowercase digits/hyphens, no leading/trailing/consecutive hyphens. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

export const RESERVED_SLUGS = new Set([
  'api', 'dashboard', 'login', 'register', 'admin', 'new', 'www', 'static',
  'assets', '_nuxt', 'favicon.ico', 'welcome',
])

export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return 'Slug must be 3-32 chars: lowercase letters, digits, hyphens (no leading/trailing/consecutive hyphens).'
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved.`
  return null
}

/* ----------------------------------------------------- per-org config cache -- */

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { t: number; cfg: SiteConfig }>()

/** Drop the cached config for a slug (call after config/image writes). */
export function invalidateOrgConfig(slug: string): void {
  cache.delete(slug)
}

/** Load + resolve an org's SiteConfig by slug (cached ~60s). Throws 404 if missing. */
export function loadOrgConfig(slug: string): SiteConfig {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.cfg

  const org = useDB().select().from(organizations).where(eq(organizations.slug, slug)).all()[0]
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  const settings = useDB().select().from(orgSettings).where(eq(orgSettings.orgId, org.id)).all()[0]
  if (!settings) throw createError({ statusCode: 404, statusMessage: 'Organization config not found' })

  const raw = JSON.parse(settings.config) as SiteConfig
  const cfg = resolveImageRefs(raw, org.slug)
  cache.set(slug, { t: Date.now(), cfg })
  return cfg
}

/* --------------------------------------------------------------- ownership -- */

/** Require the current user owns the org addressed by `slug`. Returns the org row. */
export function requireOrgOwnership(event: H3Event, slug: string) {
  const user = requireAuth(event)
  const org = useDB().select().from(organizations).where(eq(organizations.slug, slug)).all()[0]
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (org.ownerId !== user.id) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return org
}
