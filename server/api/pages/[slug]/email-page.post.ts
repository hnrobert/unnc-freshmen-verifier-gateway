import MarkdownIt from 'markdown-it'
import sharp from 'sharp'
import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import type { Locale } from '#shared/types'
import { isImageIcon, resolveIcon } from '~/lib/icon'
import { isSecureRequest } from '#server/utils/request'
import { buildWatermarkSvg } from '#server/utils/watermark'

const md = new MarkdownIt({ html: false, breaks: true, linkify: true })

// Email-ready max widths. Oversized uploads (e.g. a tall 1290×2796 poster)
// balloon the base64 payload — downscaling keeps the email deliverable.
const EMAIL_WELCOME_MAX_WIDTH = 800
const EMAIL_BRAND_MAX_WIDTH = 240

/** Resolve an image reference to email-ready bytes: pull the source (data:
 * URL, absolute http(s) URL, or DB `img:<key>` ref resolved via resolveImgRef),
 * then in one sharp pass downscale and optionally composite the watermark.
 * JPEG for opaque images (far smaller), PNG when the source has transparency.
 * Returns null if the source can't be read (caller omits the image). */
async function inlineEmailImage(
  ref: string,
  pageId: number,
  maxWidth: number,
  watermarkText: string,
): Promise<string | null> {
  let buffer: Buffer
  const src = ref.startsWith('img:') ? ((await resolveImgRef(ref, pageId)) ?? '') : ref
  if (src.startsWith('data:')) {
    const m = src.match(/^data:[^;]+;base64,(.*)$/s)
    if (!m?.[1]) return null
    buffer = Buffer.from(m[1], 'base64')
  } else if (src.startsWith('http')) {
    const ab = await $fetch<ArrayBuffer>(src, { responseType: 'arrayBuffer' }).catch(() => null)
    if (!ab) return null
    buffer = Buffer.from(ab)
  } else {
    return null
  }

  const meta = await sharp(buffer).metadata()
  const targetW = Math.min(meta.width ?? maxWidth, maxWidth)
  const targetH = Math.round(((meta.height ?? targetW) * targetW) / (meta.width ?? targetW))

  let pipe = sharp(buffer).resize({ width: targetW, withoutEnlargement: true })
  if (watermarkText) {
    pipe = pipe.composite([
      { input: buildWatermarkSvg(targetW, targetH, watermarkText), gravity: 'center' },
    ])
  }

  if (meta.hasAlpha) {
    const out = await pipe.png().toBuffer()
    return `data:image/png;base64,${out.toString('base64')}`
  }
  const out = await pipe.flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer()
  return `data:image/jpeg;base64,${out.toString('base64')}`
}

/** Public: email the page's welcome content (brand icon, welcome image,
 * title/badge/body) as a self-contained HTML email to a @nottingham.edu.cn
 * address. Blocks student/staff emails. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string

  // Welcome-mailing only exists in 'welcome' mode — in 'code' mode the email
  // tab goes through the code endpoints instead.
  const settings = await getVerificationSettings()
  if (settings.emailMode === 'code')
    throw createError({ statusCode: 403, statusMessage: 'Email verification uses code mode' })

  const body = await readBody<{ email?: unknown; locale?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  // Locale the visitor had selected on the page at send time (validated against
  // the page's supported locales below; falls back to the page default).
  const requestedLocale = String(body?.locale ?? '').trim()

  if (!email.endsWith('@nottingham.edu.cn'))
    throw createError({
      statusCode: 400,
      statusMessage: 'Only @nottingham.edu.cn emails are allowed',
    })

  if (isDisallowedEmail(email))
    throw createError({ statusCode: 403, statusMessage: 'This email address is not allowed' })

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured' })

  // Derive origin for absolute URLs (lucide icons via /api/icon.svg)
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto = isSecureRequest(event) ? 'https' : 'http'
  const origin = `${proto}://${host}`

  // Load the page's resolved config (images already resolved to data:/http URLs)
  const config = await loadPageConfig(slug)
  // Render the email in the locale the visitor had on the page — validated
  // against the page's supported locales, falling back to its default.
  const locale: Locale = config.locales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : config.defaultLocale
  const msgs = (config.messages[locale] ?? config.messages.en ?? {}) as Record<string, unknown>
  const brand = (msgs.brand ?? {}) as { title?: string; subtitle?: string }
  const welcome = (msgs.welcome ?? {}) as { title?: string; badge?: string; body?: string }

  const pageName = brand.title ?? slug

  // --- Brand icon (inline as data URI — external URLs don't render in email) ---
  const primaryColor = (config.theme as { primaryColor?: string }).primaryColor ?? '#F7D447'
  const contrastFg = (() => {
    const hex = primaryColor.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1c1917' : '#fafafa'
  })()

  async function inlineIcon(iconName: string, size: number, color: string): Promise<string> {
    try {
      const comp = resolveIcon(iconName)
      if (!comp) return ''
      const svgText = await renderToString(h(comp, { size, color, strokeWidth: 2 }))
      return `data:image/svg+xml;base64,${Buffer.from(svgText).toString('base64')}`
    } catch {
      return ''
    }
  }

  // Resolve the brand mark to an inlined data URI. Any image logo — img:<key>
  // DB ref, data: URI, or http URL — goes through the inline pipeline (240px,
  // re-encoded), so camera-photo logos don't balloon the email. Lucide names
  // render as small SVG data URIs.
  const page = await getPageBySlug(slug)
  const brandIcon = config.icons.brand
  const brandImgUrl = isImageIcon(brandIcon)
    ? brandIcon.img
    : typeof brandIcon === 'string' &&
        (brandIcon.startsWith('data:') ||
          brandIcon.startsWith('http') ||
          brandIcon.startsWith('img:'))
      ? brandIcon
      : undefined
  let brandIconHtml = ''
  if (brandImgUrl && page) {
    brandIconHtml =
      (await inlineEmailImage(brandImgUrl, page.id, EMAIL_BRAND_MAX_WIDTH, '').catch(() => '')) ??
      ''
  }
  if (!brandIconHtml && typeof brandIcon === 'string') {
    brandIconHtml = await inlineIcon(brandIcon, 22, contrastFg)
  }

  // Brand header cell. A lucide glyph sits centered in a primary-colored rounded
  // chip; a custom image logo is shown DIRECTLY — no accent chip/background, just
  // the branding image. object-contain keeps the whole logo visible without
  // cropping or distortion (the chip is for glyphs that need a backdrop).
  const brandCellHtml = !brandIconHtml
    ? ''
    : brandImgUrl
      ? `<td valign="middle" style="width:40px;height:40px;"><img src="${brandIconHtml}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;object-fit:contain;" /></td>`
      : `<td align="center" valign="middle" style="width:40px;height:40px;background-color:${primaryColor};border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);overflow:hidden;"><img src="${brandIconHtml}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;margin:9px auto;" /></td>`
  const brandHeaderHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>
${brandCellHtml}
<td style="padding-left:12px;vertical-align:middle;">
<div class="ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#0a0a0a;line-height:1.3;">${pageName}</div>
${brand.subtitle ? `<div class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#737373;line-height:1.3;">${brand.subtitle}</div>` : ''}
</td>
</tr></table>`

  // --- Welcome image, INLINED as a data URI (resize + optional watermark of
  // the email prefix in one sharp pass). A failure omits the image rather than
  // failing the whole email — logged so outages are visible. ---
  let welcomeImageHtml = ''
  if (config.welcome.image && page) {
    const watermarkText = config.welcome.watermark ? (email.split('@')[0] ?? '') : ''
    const img = await inlineEmailImage(
      config.welcome.image,
      page.id,
      EMAIL_WELCOME_MAX_WIDTH,
      watermarkText,
    ).catch((e: unknown) => {
      console.error('[email-page] welcome image inline failed:', e)
      return null
    })
    if (img) {
      welcomeImageHtml = `<img src="${img}" alt="" style="display:block;width:100%;max-width:480px;margin:0 auto 24px;border-radius:12px;" />`
    }
  }

  // --- Welcome body (markdown → HTML) ---
  const bodyHtml = welcome.body ? md.render(welcome.body) : ''

  // --- Welcome badge (above the title, matching WelcomeContent.vue) ---
  const badgeHtml = welcome.badge
    ? `<div style="text-align:center;margin-bottom:12px;"><span class="badge-bg" style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:500;background:#f5f5f5;color:#737373;">${welcome.badge}</span></div>`
    : ''

  // --- Welcome title (with icon inlined as data URI) ---
  const welcomeIcon = config.icons.welcome
  let welcomeIconHtml = ''
  if (typeof welcomeIcon === 'string') {
    if (welcomeIcon.startsWith('data:') || welcomeIcon.startsWith('http')) {
      welcomeIconHtml = welcomeIcon
    } else {
      welcomeIconHtml = await inlineIcon(welcomeIcon, 28, primaryColor)
    }
  }
  const welcomeIconImg = welcomeIconHtml
    ? `<img src="${welcomeIconHtml}" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;width:28px;height:28px;margin-right:8px;" />`
    : ''
  const titleHtml = welcome.title
    ? `<h2 class="ink" style="margin:0 0 24px;font-size:28px;line-height:1.3;font-weight:600;color:#0a0a0a;text-align:center;">${welcomeIconImg}${welcome.title}</h2>`
    : ''

  // --- Build the email HTML (neutral palette + dark mode) ---
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<style>
@media (prefers-color-scheme: dark) {
  .bg { background-color: #0a0a0a !important; color: #0a0a0a !important; }
  .surface { background-color: #171717 !important; border-color: #232323 !important; }
  .rule { border-color: #232323 !important; }
  .ink { color: #fafafa !important; }
  .body-ink { color: #d4d4d4 !important; }
  .body-ink a { color: #a1a1a1 !important; }
  .muted { color: #a1a1a1 !important; }
  .badge-bg { background-color: #262626 !important; color: #a1a1a1 !important; }
}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#fafafa;color:#fafafa;">
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="surface" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;">

<!-- Brand header (matches BrandMark.vue layout) -->
<tr><td class="rule" style="padding:22px 28px;border-bottom:1px solid #e5e5e5;">
${brandHeaderHtml}
</td></tr>

<!-- Content -->
<tr><td style="padding:28px 28px 8px;">
${badgeHtml}
${titleHtml}
${welcomeImageHtml}
<div class="body-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#404040;">${bodyHtml}</div>
</td></tr>

<!-- Footer -->
<tr><td class="rule" style="padding:20px 28px;border-top:1px solid #e5e5e5;">
<p class="muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#737373;">
${emailMsg(config, locale, 'noReply')}
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const limit = checkEmailSend('welcome', email)
  if (!limit.allowed) throw createError(emailLimitError(limit))

  try {
    await sendMailWithConfig(cfg, {
      to: email,
      subject: `${pageName}`,
      // subject: `[no-reply] ${pageName}`,
      body: emailHtml,
      html: true,
    })
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send email',
    })
  }

  return { ok: true, warning: limit.warning }
})
