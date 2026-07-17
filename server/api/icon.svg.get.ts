import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { resolveIcon } from '../../lib/icon'

/**
 * Renders a lucide icon as an SVG favicon (HTTP 200, image/svg+xml).
 *
 * Used by the org layout when the brand icon is a lucide *name*. Image-based
 * brands (`img:<key>` / URLs) are already resolved to a data: or http URL by
 * `loadOrgConfig` → `resolveImageRefs`, so the layout links those directly; only
 * vector brands need this route to turn a name into renderable favicon bytes.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const name = String(q.name ?? 'GraduationCap')
  const color = String(q.color ?? '#F7D447')
  const strokeWidth = Number(q.strokeWidth ?? 2) || 2

  const comp = resolveIcon(name) ?? resolveIcon('CircleHelp')!
  const svg = await renderToString(h(comp, { size: 64, color, strokeWidth }))

  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return svg
})
