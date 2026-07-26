import MarkdownIt from 'markdown-it'
import sharp from 'sharp'
import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import type { Locale } from '#shared/types'
import { resolveIcon } from '~/lib/icon'
import { isSecureRequest } from '#server/utils/request'
import { buildWatermarkSvg } from '#server/utils/watermark'

const md = new MarkdownIt({ html: false, breaks: true, linkify: true })

// Email-ready max width for the welcome image. Oversized uploads (e.g. a tall
// 1290×2796 poster) balloon the base64 payload and get stripped by some mail
// providers — downscaling keeps the email deliverable.
const EMAIL_IMG_MAX_WIDTH = 800

// System-generated footer line (not org-customizable), localized to the locale
// the visitor had selected on the page when they hit send.
const FOOTER_NO_REPLY: Record<Locale, string> = {
  zh: '本邮件由系统自动发送，请勿直接回复。',
  en: 'This email was sent automatically by the system. Please do not reply.',
}

/** Resolve a welcome-image reference to an email-ready data URL: pull the bytes
 * (from a `data:` URL, an absolute http(s) URL, or a same-origin path), then in
 * a single sharp pass downscale, optionally composite the watermark, and
 * re-encode — JPEG for opaque images (far smaller, more deliverable), PNG when
 * the source has transparency. Returns null if the source can't be read. */
async function resolveWelcomeImage(
  ref: string,
  origin: string,
  watermarkText: string,
): Promise<string | null> {
  let buffer: Buffer
  if (ref.startsWith('data:')) {
    const m = ref.match(/^data:[^;]+;base64,(.*)$/s)
    if (!m?.[1]) return null
    buffer = Buffer.from(m[1], 'base64')
  } else {
    const url = ref.startsWith('http') ? ref : `${origin}/${ref.replace(/^\.?\//, '')}`
    const ab = await $fetch<ArrayBuffer>(url, { responseType: 'arrayBuffer' }).catch(() => null)
    if (!ab) return null
    buffer = Buffer.from(ab)
  }

  const meta = await sharp(buffer).metadata()
  const origW = meta.width ?? EMAIL_IMG_MAX_WIDTH
  const origH = meta.height ?? Math.round(origW * 0.75)
  const targetW = Math.min(origW, EMAIL_IMG_MAX_WIDTH)
  const targetH = Math.round((origH * targetW) / origW)

  let pipe = sharp(buffer).resize({ width: targetW, withoutEnlargement: true })
  if (watermarkText) {
    pipe = pipe.composite([
      { input: buildWatermarkSvg(targetW, targetH, watermarkText), gravity: 'center' },
    ])
  }

  // Opaque → JPEG (small, universal); transparent → PNG (preserve alpha).
  if (meta.hasAlpha) {
    const out = await pipe.png().toBuffer()
    return `data:image/png;base64,${out.toString('base64')}`
  }
  const out = await pipe.flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer()
  return `data:image/jpeg;base64,${out.toString('base64')}`
}

/** Public: email the org's welcome content (brand icon, welcome image,
 * title/badge/body) as a self-contained HTML email to a @nottingham.edu.cn
 * address. Blocks student/staff emails. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const body = await readBody<{ email?: unknown; locale?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  // Locale the visitor had selected on the page at send time (validated against
  // the org's supported locales below; falls back to the org default).
  const requestedLocale = String(body?.locale ?? '').trim()

  if (!email.endsWith('@nottingham.edu.cn'))
    throw createError({
      statusCode: 400,
      statusMessage: 'Only @nottingham.edu.cn emails are allowed',
    })

  if (/student|staff/i.test(email))
    throw createError({ statusCode: 403, statusMessage: 'This email address is not allowed' })

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured' })

  // Derive origin for absolute URLs (lucide icons via /api/icon.svg)
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const host = xfh || getRequestHeader(event, 'host') || 'localhost'
  const proto = isSecureRequest(event) ? 'https' : 'http'
  const origin = `${proto}://${host}`

  // Load the org's resolved config (images already resolved to data:/http URLs)
  const config = await loadOrgConfig(slug)
  // Render the email in the locale the visitor had on the page — validated
  // against the org's supported locales, falling back to its default.
  const locale: Locale = config.locales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : config.defaultLocale
  const msgs = (config.messages[locale] ?? config.messages.en ?? {}) as Record<string, unknown>
  const brand = (msgs.brand ?? {}) as { title?: string; subtitle?: string }
  const welcome = (msgs.welcome ?? {}) as { title?: string; badge?: string; body?: string }

  const orgName = brand.title ?? slug

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

  // Inline any image URL (data: as-is, http: fetched → data URI) so email
  // clients don't need external access.
  async function inlineImg(url: string): Promise<string> {
    if (url.startsWith('data:')) return url
    if (url.startsWith('http')) {
      try {
        const ab = await $fetch<ArrayBuffer>(url, { responseType: 'arrayBuffer' })
        return `data:image/png;base64,${Buffer.from(ab).toString('base64')}`
      } catch {
        return ''
      }
    }
    return ''
  }

  let brandIconHtml = ''
  const brandIcon = config.icons.brand
  if (typeof brandIcon === 'string') {
    if (brandIcon.startsWith('data:') || brandIcon.startsWith('http')) {
      brandIconHtml = await inlineImg(brandIcon)
    } else {
      brandIconHtml = await inlineIcon(brandIcon, 22, contrastFg)
    }
  }

  // Brand header matches BrandMark.vue: icon in primary-colored box + title + subtitle
  const brandIconBox = brandIconHtml
    ? `<img src="${brandIconHtml}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;" />`
    : ''
  const brandHeaderHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>
<td style="width:40px;height:40px;background-color:${primaryColor};border-radius:6px;vertical-align:middle;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.05);overflow:hidden;">${brandIconBox}</td>
<td style="padding-left:12px;vertical-align:middle;">
<div class="ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#0a0a0a;line-height:1.3;">${orgName}</div>
${brand.subtitle ? `<div class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#737373;line-height:1.3;">${brand.subtitle}</div>` : ''}
</td>
</tr></table>`

  // --- Welcome image (resized for email + optional watermark = email prefix) ---
  let welcomeImageHtml = ''
  const welcomeRef = config.welcome.image
  const watermarkText = config.welcome.watermark ? (email.split('@')[0] ?? '') : ''
  if (welcomeRef) {
    try {
      // config keeps welcome.image as `img:<key>` (un-inlined); resolve it to a
      // data:/http: source before the resize/watermark pipeline runs.
      const org = await getOrgBySlug(slug)
      const src = org ? await resolveImgRef(welcomeRef, org.id) : null
      if (src) {
        const img = await resolveWelcomeImage(src, origin, watermarkText)
        if (img) {
          welcomeImageHtml = `<img src="${img}" alt="" style="display:block;width:100%;max-width:480px;margin:0 auto 24px;border-radius:12px;" />`
        }
      }
    } catch {
      // image unreadable — omit it rather than failing the whole email
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
  .bg { background-color: #0a0a0a !important; }
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
<body class="bg" style="margin:0;padding:0;background-color:#fafafa;">
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
${FOOTER_NO_REPLY[locale]}
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  try {
    await sendMailWithConfig(cfg, {
      to: email,
      subject: `${orgName}`,
      // subject: `[no-reply] ${orgName}`,
      body: emailHtml,
      html: true,
    })
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send email',
    })
  }

  return { ok: true }
})
