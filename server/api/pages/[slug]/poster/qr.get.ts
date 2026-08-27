import QRCode from 'qrcode'

/**
 * Public: the page's share QR code as raw PNG bytes (Microsoft-Forms-style —
 * scanning opens the public verify page). Used by the poster endpoints and
 * linkable anywhere (<img src="/api/pages/:slug/poster/qr">).
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto =
    getRequestHeader(event, 'x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const url = `${proto}://${host}/${slug}`

  const png = await QRCode.toBuffer(url, {
    width: 480,
    margin: 2,
    color: { dark: '#1c1917', light: '#ffffff' },
  })
  setResponseHeader(event, 'content-type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return png
})
