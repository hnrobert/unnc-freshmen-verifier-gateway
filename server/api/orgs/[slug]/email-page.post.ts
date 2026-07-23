import MarkdownIt from 'markdown-it'
import { isSecureRequest } from '#server/utils/request'

const md = new MarkdownIt({ html: false, breaks: true, linkify: true })

/** Public: email the org's welcome content (brand icon, welcome image,
 * title/badge/body) as a self-contained HTML email to a @nottingham.edu.cn
 * address. Blocks student/staff emails. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const body = await readBody<{ email?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()

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
  const msgs = (config.messages.en ?? {}) as Record<string, unknown>
  const brand = (msgs.brand ?? {}) as { title?: string; subtitle?: string }
  const welcome = (msgs.welcome ?? {}) as { title?: string; badge?: string; body?: string }

  const orgName = brand.title ?? slug

  // --- Brand icon ---
  let brandIconHtml = ''
  const brandIcon = config.icons.brand
  if (typeof brandIcon === 'string') {
    if (brandIcon.startsWith('data:') || brandIcon.startsWith('http')) {
      brandIconHtml = `<img src="${brandIcon}" width="40" height="40" alt="" style="display:inline-block;vertical-align:middle;width:40px;height:40px;border-radius:8px;" />`
    } else {
      brandIconHtml = `<img src="${origin}/api/icon.svg?name=${encodeURIComponent(brandIcon)}&color=${encodeURIComponent((config.theme as { primaryColor?: string }).primaryColor ?? '#F7D447')}" width="40" height="40" alt="" style="display:inline-block;vertical-align:middle;width:40px;height:40px;" />`
    }
  }

  // --- Welcome image ---
  let welcomeImageHtml = ''
  const welcomeImg = config.welcome.image
  if (welcomeImg && (welcomeImg.startsWith('data:') || welcomeImg.startsWith('http'))) {
    welcomeImageHtml = `<img src="${welcomeImg}" alt="" style="display:block;width:100%;max-width:480px;margin:0 auto 24px;border-radius:12px;" />`
  }

  // --- Welcome body (markdown → HTML) ---
  const bodyHtml = welcome.body ? md.render(welcome.body) : ''

  // --- Welcome badge ---
  const badgeHtml = welcome.badge
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:500;background:#f5f5f5;color:#737373;margin-bottom:12px;">${welcome.badge}</span>`
    : ''

  // --- Welcome title ---
  const titleHtml = welcome.title
    ? `<h2 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0a0a0a;">${welcome.title}</h2>`
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

<!-- Brand header -->
<tr><td class="rule" style="padding:22px 28px;border-bottom:1px solid #e5e5e5;">
${brandIconHtml}
${orgName !== slug ? `<span class="ink" style="margin-left:10px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:600;color:#0a0a0a;">${orgName}</span>` : ''}
${brand.subtitle ? `<br/><span class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#737373;">${brand.subtitle}</span>` : ''}
</td></tr>

<!-- Content -->
<tr><td style="padding:28px 28px 8px;">
${welcomeImageHtml}
${badgeHtml}
${titleHtml}
<div class="body-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#404040;">${bodyHtml}</div>
</td></tr>

<!-- Footer -->
<tr><td class="rule" style="padding:20px 28px;border-top:1px solid #e5e5e5;">
<p class="muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#737373;">
This email was sent automatically by the system. Please do not reply.
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
      subject: `[no-reply] ${orgName}`,
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
