/**
 * Per-org email text lookup. Org-scoped emails (invitation, QR-expiry reminder,
 * welcome-content footer) read their strings from the org's `config.messages`
 * (`<locale>.email.*`) so owners can customize them in the editor; this resolves
 * a key with fallbacks: org(locale) → org(en) → default(locale) → default(en).
 * {@link tpl} fills `{token}` placeholders the endpoints supply.
 */
import defaultConfig from '#shared/lib/defaultConfig'
import type { Locale, SiteConfig } from '#shared/types'

type Msgs = Record<string, unknown> | undefined

function emailKey(msgs: Msgs, key: string): string {
  const email = msgs?.email as Record<string, string> | undefined
  const v = email?.[key]
  return v && typeof v === 'string' ? v : ''
}

/** Resolve an org email string for `locale` (org → en → default → default-en). */
export function emailMsg(config: SiteConfig, locale: Locale, key: string): string {
  const m = config.messages as Record<Locale, Msgs>
  const d = defaultConfig.messages as Record<Locale, Msgs>
  return (
    emailKey(m[locale], key) ||
    emailKey(m.en, key) ||
    emailKey(d[locale], key) ||
    emailKey(d.en, key)
  )
}

/** Replace `{token}` placeholders in `s` with `vars` (missing → ''). */
export function tpl(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
