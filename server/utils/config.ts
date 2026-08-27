import type { IconRef, SiteConfig } from '#shared/types'
import { AppDataSource } from './database'
import { PageImage } from '#server/entities/pageImage.entity'

/** In-process cache: pageId+key → data URL (avoids re-fetching on every request). */
const dataUrlCache = new Map<string, string>()

/** Look up an page image by pageId + key, return as a `data:` URL (or null). */
async function toDataUrl(pageId: number, key: string): Promise<string | null> {
  const cacheKey = `${pageId}:${key}`
  const cached = dataUrlCache.get(cacheKey)
  if (cached) return cached

  const img = await AppDataSource.getRepository(PageImage).findOne({ where: { pageId, key } })
  if (!img) return null

  const url = `data:${img.mime};base64,${img.base64}`
  dataUrlCache.set(cacheKey, url)
  return url
}

/** Resolve a single image ref to a usable URL, used by endpoints that need the
 * welcome image bytes now that `resolveImageRefs` no longer inlines it (it's
 * lazy-loaded by the welcome page instead, keeping big images out of SSR HTML).
 * `img:<key>` → cached data URL; `data:`/`http:` → passthrough; else null. */
export async function resolveImgRef(
  ref: string | undefined,
  pageId: number,
): Promise<string | null> {
  if (!ref) return null
  if (ref.startsWith('img:')) return toDataUrl(pageId, ref.slice(4))
  if (ref.startsWith('data:') || ref.startsWith('http')) return ref
  return null
}

/** Resolve an `img:<key>` ref by fetching the base64 from DB → data URL. */
async function resolveRef(ref: IconRef | undefined, pageId: number): Promise<IconRef | undefined> {
  if (!ref) return ref
  if (typeof ref === 'string') {
    if (!ref.startsWith('img:')) return ref
    const url = await toDataUrl(pageId, ref.slice(4))
    return url ?? ref
  }
  if (ref.img && ref.img.startsWith('img:')) {
    const url = await toDataUrl(pageId, ref.img.slice(4))
    return url ? { ...ref, img: url } : ref
  }
  return ref
}

/** Invalidate the data URL cache for an page (call after image uploads). */
export function invalidateImageCache(pageId: number): void {
  for (const key of dataUrlCache.keys()) {
    if (key.startsWith(`${pageId}:`)) dataUrlCache.delete(key)
  }
}

/**
 * Resolve all `img:<key>` references by fetching base64 from DB and constructing
 * `data:` URLs — the backend sends base64, the frontend just renders `<img src>`.
 */
export async function resolveImageRefs(
  config: SiteConfig,
  slug: string,
  pageId: number,
): Promise<SiteConfig> {
  const icons = { ...config.icons }
  for (const key of Object.keys(icons) as (keyof typeof icons)[]) {
    icons[key] = (await resolveRef(icons[key], pageId)) as IconRef
  }

  // NOTE: welcome.image is intentionally left unresolved (kept as `img:<key>`).
  // The welcome page lazy-loads it via /api/pages/<slug>/welcome-image after
  // first paint, so a large poster image never blocks SSR or bloats the
  // config/hydration payload. Endpoints that need its bytes call resolveImgRef.

  const background = { ...config.background }
  if (background.image?.startsWith('img:')) {
    const url = await toDataUrl(pageId, background.image.slice(4))
    if (url) background.image = url
  }

  return { ...config, icons, background }
}
