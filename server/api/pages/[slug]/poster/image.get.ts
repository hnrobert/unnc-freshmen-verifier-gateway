import sharp from 'sharp'
import type { Sharp } from 'sharp'
import QRCode from 'qrcode'
import {
  POSTER_W,
  POSTER_H,
  POSTER_QR_CARD,
  POSTER_QR_TOP,
  POSTER_TITLE_CENTER,
  escapeXml,
  isPosterTheme,
  posterPalette,
  resolvePosterTitle,
  wrapTitle,
} from '#shared/lib/poster'

/**
 * Public: the share poster as a PNG (Microsoft-Forms-style: page background +
 * title + public URL + QR code). Query:
 *   ?title=<custom title>   falls back to config.share.posterTitle → brand
 *                           title → page name
 *   ?theme=page|dark|light|primary   `page` uses the page's background image
 *                           (default; dark is the fallback when it has none)
 *
 * Rendered server-side with sharp so it can be hot-linked, embedded in iframes
 * (see ../poster/index.get.ts) or downloaded directly. The dashboard Share tab
 * renders the same layout client-side on a canvas for interactive export.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const q = getQuery(event)
  const themeArg = String(q.theme ?? 'page')
  const theme = isPosterTheme(themeArg) ? themeArg : 'page'

  const config = await loadPageConfig(slug)
  const page = await getPageBySlug(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

  const title = resolvePosterTitle(String(q.title ?? ''), config, page.name)
  const palette = posterPalette(
    theme === 'dark' ? 'dark' : theme,
    config.theme.primaryColor ?? '#F7D447',
  )

  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto =
    getRequestHeader(event, 'x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const publicUrl = `${proto}://${host}/${slug}`

  // --- Background layer -----------------------------------------------------
  let canvas: Sharp | undefined
  let hasPhotoBg = false
  if (theme === 'page' && config.background?.image) {
    const src =
      config.background.image.startsWith('img:') && page
        ? await resolveImgRef(config.background.image, page.id)
        : config.background.image
    if (src?.startsWith('data:')) {
      const m = src.match(/^data:[^;]+;base64,(.*)$/s)
      if (m?.[1]) {
        canvas = sharp(Buffer.from(m[1], 'base64')).resize(POSTER_W, POSTER_H, { fit: 'cover' })
        hasPhotoBg = true
      }
    }
  }
  if (!hasPhotoBg) {
    const primary = config.theme.primaryColor ?? '#F7D447'
    const bgSvg =
      theme === 'primary'
        ? `<svg width="${POSTER_W}" height="${POSTER_H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(primary)}"/><stop offset="1" stop-color="#141414"/></linearGradient></defs><rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#g)"/></svg>`
        : `<svg width="${POSTER_W}" height="${POSTER_H}" xmlns="http://www.w3.org/2000/svg"><rect width="${POSTER_W}" height="${POSTER_H}" fill="${theme === 'light' ? '#f5f5f5' : '#171717'}"/></svg>`
    canvas = sharp(Buffer.from(bgSvg))
  }

  // --- Text overlay (dark scrim over photo backgrounds for readability) ----
  const scrim = hasPhotoBg
    ? `<rect width="${POSTER_W}" height="${POSTER_H}" fill="rgba(10,10,10,0.5)"/>`
    : ''
  const fontSize = 60
  const lineHeight = 74
  const lines = wrapTitle(title, fontSize, 880, 3)
  const startY = POSTER_TITLE_CENTER + fontSize / 2 - ((lines.length - 1) * lineHeight) / 2
  const titleTspans = lines
    .map(
      (l, i) => `<tspan x="${POSTER_W / 2}" y="${startY + i * lineHeight}">${escapeXml(l)}</tspan>`,
    )
    .join('')
  const qrLeft = (POSTER_W - POSTER_QR_CARD) / 2
  const qrPad = 44
  const overlay = Buffer.from(
    `<svg width="${POSTER_W}" height="${POSTER_H}" xmlns="http://www.w3.org/2000/svg">${scrim}
<text text-anchor="middle" font-family="-apple-system,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" font-size="${fontSize}" font-weight="700" fill="${palette.text}">${titleTspans}</text>
<rect x="${qrLeft}" y="${POSTER_QR_TOP}" width="${POSTER_QR_CARD}" height="${POSTER_QR_CARD}" rx="28" fill="#ffffff"/>
</svg>`,
  )

  // --- QR (large, inside the white card's safe area) ---------------------------
  const qrPng = await QRCode.toBuffer(publicUrl, {
    width: 900,
    margin: 1,
    color: { dark: '#1c1917', light: '#ffffff' },
  })

  const piped = canvas!.composite([
    { input: overlay, gravity: 'center' },
    {
      input: await sharp(qrPng)
        .resize(POSTER_QR_CARD - 2 * qrPad)
        .png()
        .toBuffer(),
      left: qrLeft + qrPad,
      top: POSTER_QR_TOP + qrPad,
    },
  ])
  // Photo backgrounds compress far better as JPEG (~5× smaller than PNG);
  // flat/gradient themes stay PNG (sharp text, tiny either way).
  const out = hasPhotoBg
    ? await piped.jpeg({ quality: 88 }).toBuffer()
    : await piped.png().toBuffer()

  setResponseHeader(event, 'content-type', hasPhotoBg ? 'image/jpeg' : 'image/png')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600')
  return out
})
