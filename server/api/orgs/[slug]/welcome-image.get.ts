/** Returns the welcome image, optionally watermarked with the visitor's name.
 * Public endpoint — the client fetches this as text and uses the returned
 * data:/http URL directly as the <img src>. Watermarking (when enabled) is
 * done server-side with sharp before the URL is handed back. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const name = String(getQuery(event).name ?? '')

  const config = await loadOrgConfig(slug)
  const image = config.welcome.image
  if (!image) throw createError({ statusCode: 404, statusMessage: 'No welcome image' })

  // Watermark enabled + name given → composite text, return the new data URL.
  if (config.welcome.watermark && name && image.startsWith('data:')) {
    const watermarked = await watermarkImage(image, name)
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return watermarked
  }

  // Otherwise echo the resolved image URL (data: or http:) verbatim.
  if (image.startsWith('data:') || image.startsWith('http')) return image
  throw createError({ statusCode: 404, statusMessage: 'Image not accessible' })
})
