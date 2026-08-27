// Byte-exact wrapper over email-poster's renderTemplate: the site shell
// (email/template.html, read at Nuxt config time and shipped via
// runtimeConfig.emailTemplate) is filled with the same {{PREHEADER}}/
// {{TITLE}}/{{BODY}}/{{ACTION_BLOCK}}/{{YEAR}}/{{LOGO}} tokens as the original
// hand-rolled renderer — including its 4-character escape (the library's
// escapeHtml additionally escapes `'` → `&#39;`, which would change the bytes
// of e.g. the default "You've been invited…" preheader). Rendering is
// delegated to the library's token engine; only the legacy escaping and CTA
// markup are kept local so the output never differs by a single byte.

import { renderTemplate } from 'email-poster/template'

export interface EmailContent {
  /** Big heading inside the card. */
  title: string
  /** Inner HTML for the message body (caller-supplied — not escaped). */
  bodyHtml: string
  /** Optional CTA button. Rendered only when both label and url are present. */
  actionLabel?: string
  actionUrl?: string
  /** Optional hidden preview text shown after the subject in inbox lists. */
  preheader?: string
}

/** The site's legacy 4-char escape — kept so output stays byte-identical. */
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Render the site-themed HTML email (light by default, dark via prefers-color-scheme). */
export function renderEmail(c: EmailContent): string {
  const template = useRuntimeConfig().emailTemplate as string | undefined
  const logo = useRuntimeConfig().emailLogo as string | undefined
  if (!template) throw new Error('Email template missing (runtimeConfig.emailTemplate)')

  const action =
    c.actionLabel && c.actionUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 4px;"><tr><td bgcolor="#F7D447" style="border-radius: 10px;"><a href="${escapeHtml(c.actionUrl)}" target="_blank" rel="noopener" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #1c1917; text-decoration: none; border-radius: 10px;">${escapeHtml(c.actionLabel)}</a></td></tr></table>`
      : ''

  return renderTemplate(
    template,
    {},
    {
      PREHEADER: escapeHtml(c.preheader ?? ''),
      TITLE: escapeHtml(c.title),
      BODY: c.bodyHtml,
      ACTION_BLOCK: action,
      YEAR: String(new Date().getUTCFullYear()),
      LOGO: logo ?? '',
    },
  )
}
