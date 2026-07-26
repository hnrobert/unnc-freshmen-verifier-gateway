import { getOrgBySlug } from '#server/utils/orgs'

/** Returns the welcome image, optionally watermarked with the visitor's name.
 * Public endpoint — the client fetches this as text and uses the returned
 * data:/http URL directly as the <img src>. Watermarking (when enabled) is
 * done server-side with sharp before the URL is handed back.
 *
 * The welcome image ref is left unresolved in loadOrgConfig (kept as
 * `img:<key>`) so it stays out of the SSR config payload; this endpoint
 * resolves it on demand via resolveImgRef. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const name = String(getQuery(event).name ?? '')

  const config = await loadOrgConfig(slug)
  const raw = config.welcome.image
  if (!raw) throw createError({ statusCode: 404, statusMessage: 'No welcome image' })

  // Resolve img:<key> → data URL ourselves (config no longer inlines it).
  const org = await getOrgBySlug(slug)
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  const image = await resolveImgRef(raw, org.id)
  if (!image) throw createError({ statusCode: 404, statusMessage: 'Image not accessible' })

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // Watermark enabled + name given → composite text, return the new data URL.
  // watermarkImage is a no-op for non-data: URLs, matching prior behaviour.
  if (config.welcome.watermark && name) {
    // Watermarked result is per-visitor (embeds the name) — don't cache publicly.
    return await watermarkImage(image, name)
  }

  // Static welcome image — cacheable.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return image
})
