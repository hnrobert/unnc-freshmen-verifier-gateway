import type { IconRef, SiteConfig } from '#shared/types'
import { AppDataSource } from './database'
import { OrgImage } from '#server/entities/orgImage.entity'

/** In-process cache: orgId+key → data URL (avoids re-fetching on every request). */
const dataUrlCache = new Map<string, string>()

/** Look up an org image by orgId + key, return as a `data:` URL (or null). */
async function toDataUrl(orgId: number, key: string): Promise<string | null> {
  const cacheKey = `${orgId}:${key}`
  const cached = dataUrlCache.get(cacheKey)
  if (cached) return cached

  const img = await AppDataSource.getRepository(OrgImage).findOne({ where: { orgId, key } })
  if (!img) return null

  const url = `data:${img.mime};base64,${img.base64}`
  dataUrlCache.set(cacheKey, url)
  return url
}

/** Resolve an `img:<key>` ref by fetching the base64 from DB → data URL. */
async function resolveRef(ref: IconRef | undefined, orgId: number): Promise<IconRef | undefined> {
  if (!ref) return ref
  if (typeof ref === 'string') {
    if (!ref.startsWith('img:')) return ref
    const url = await toDataUrl(orgId, ref.slice(4))
    return url ?? ref
  }
  if (ref.img && ref.img.startsWith('img:')) {
    const url = await toDataUrl(orgId, ref.img.slice(4))
    return url ? { ...ref, img: url } : ref
  }
  return ref
}

/** Invalidate the data URL cache for an org (call after image uploads). */
export function invalidateImageCache(orgId: number): void {
  for (const key of dataUrlCache.keys()) {
    if (key.startsWith(`${orgId}:`)) dataUrlCache.delete(key)
  }
}

/**
 * Resolve all `img:<key>` references by fetching base64 from DB and constructing
 * `data:` URLs — the backend sends base64, the frontend just renders `<img src>`.
 */
export async function resolveImageRefs(
  config: SiteConfig,
  slug: string,
  orgId: number,
): Promise<SiteConfig> {
  const icons = { ...config.icons }
  for (const key of Object.keys(icons) as (keyof typeof icons)[]) {
    icons[key] = (await resolveRef(icons[key], orgId)) as IconRef
  }

  const welcome = { ...config.welcome }
  if (welcome.image?.startsWith('img:')) {
    const url = await toDataUrl(orgId, welcome.image.slice(4))
    if (url) welcome.image = url
  }

  const background = { ...config.background }
  if (background.image?.startsWith('img:')) {
    const url = await toDataUrl(orgId, background.image.slice(4))
    if (url) background.image = url
  }

  return { ...config, icons, welcome, background }
}
