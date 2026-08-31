/**
 * Public: an HTML wrapper around the server-rendered poster — the iframe
 * embed target (Microsoft-Forms-style "embed in a webpage" share). Forwards
 * ?title=, ?theme= and the size/font query params to the image endpoint;
 * the saved share settings fill in whatever the query omits.
 *
 *   <iframe src="https://host/api/pages/<slug>/poster?title=Hello&theme=dark"
 *           width="640" height="400" style="border:0;border-radius:12px"
 *           loading="lazy" title="..."></iframe>
 */
import { normalizeShareSettings } from '#shared/lib/poster'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const q = getQuery(event)
  const params = new URLSearchParams()
  if (q.title) params.set('title', String(q.title))
  if (q.theme) params.set('theme', String(q.theme))
  for (const key of ['fontSize', 'width', 'height']) {
    if (q[key]) params.set(key, String(q[key]))
  }
  const imgSrc = `./image?${params.toString()}`

  const page = await getPageBySlug(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  const share = await loadPageShareSettings(page.id)
  // Frame styling (the <img> border inside the iframe) — clamped by the same
  // shared normalizer the PUT endpoint and the poster render use.
  const frame = normalizeShareSettings({
    borderWidth: q.borderWidth ?? share.borderWidth,
    borderRadius: q.borderRadius ?? share.borderRadius,
  })

  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600')
  setResponseHeader(event, 'X-Frame-Options', 'ALLOWALL')
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent}body{display:flex;align-items:center;justify-content:center;box-sizing:border-box}img{box-sizing:border-box;max-width:100%;max-height:100%;border:${frame.borderWidth}px solid #d4d4d4;border-radius:${frame.borderRadius}px;display:block}</style>
</head><body><img src="${imgSrc}" alt="Share poster for /${slug.replace(/"/g, '&quot;')}" referrerpolicy="no-referrer"></body></html>`
})
