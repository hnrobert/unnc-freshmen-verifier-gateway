import type { IconRef, SiteConfig } from '../../shared/types'

/** Resolve an `img:<key>` ref to the public serving URL for this org. */
function resolveRef(ref: IconRef | undefined, slug: string): IconRef | undefined {
  if (!ref) return ref
  if (typeof ref === 'string') {
    return ref.startsWith('img:') ? `/api/orgs/${slug}/img/${ref.slice(4)}` : ref
  }
  if (ref.img && ref.img.startsWith('img:')) {
    return { ...ref, img: `/api/orgs/${slug}/img/${ref.img.slice(4)}` }
  }
  return ref
}

/**
 * Resolve all `img:<key>` references in a stored SiteConfig to their public
 * serving URLs (`/api/orgs/:slug/img/:key`). Other image refs (public paths /
 * remote URLs) are left untouched.
 */
export function resolveImageRefs(config: SiteConfig, slug: string): SiteConfig {
  const icons = { ...config.icons }
  for (const key of Object.keys(icons) as (keyof typeof icons)[]) {
    icons[key] = resolveRef(icons[key], slug) as IconRef
  }
  const welcome = { ...config.welcome }
  if (welcome.image?.startsWith('img:')) {
    welcome.image = `/api/orgs/${slug}/img/${welcome.image.slice(4)}`
  }
  return { ...config, icons, welcome }
}
