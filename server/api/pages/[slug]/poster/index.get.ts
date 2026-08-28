/**
 * Public: an HTML wrapper around the server-rendered poster — the iframe
 * embed target (Microsoft-Forms-style "embed in a webpage" share). Forwards
 * ?title= and ?theme= to the image endpoint.
 *
 *   <iframe src="https://host/api/pages/<slug>/poster?title=Hello&theme=dark"
 *           width="640" height="400" style="border:0;border-radius:12px"
 *           loading="lazy" title="..."></iframe>
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const q = getQuery(event)
  const params = new URLSearchParams()
  if (q.title) params.set('title', String(q.title))
  if (q.theme) params.set('theme', String(q.theme))
  if (q.fontSize) params.set('fontSize', String(q.fontSize))
  const imgSrc = `./image?${params.toString()}`

  const page = await getPageBySlug(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  const share = await loadPageShareSettings(page.id)
  const requestedRadius = Number(q.borderRadius ?? share.borderRadius)
  const radius = Number.isFinite(requestedRadius)
    ? Math.min(160, Math.max(0, Math.round(requestedRadius)))
    : share.borderRadius
  const requestedBorder = Number(q.borderWidth ?? share.borderWidth)
  const border = Number.isFinite(requestedBorder)
    ? Math.min(20, Math.max(0, Math.round(requestedBorder)))
    : share.borderWidth

  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600')
  setResponseHeader(event, 'X-Frame-Options', 'ALLOWALL')
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent}body{display:flex;align-items:center;justify-content:center;box-sizing:border-box}img{box-sizing:border-box;max-width:100%;max-height:100%;border:${border}px solid #d4d4d4;border-radius:${radius}px;display:block}</style>
</head><body><img src="${imgSrc}" alt="Share poster for /${slug.replace(/"/g, '&quot;')}" referrerpolicy="no-referrer"></body></html>`
})
