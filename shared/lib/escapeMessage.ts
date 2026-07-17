/**
 * Escape the vue-i18n message-format metacharacters so a literal string is
 * compiled as plain text instead of being parsed as interpolation / linked /
 * plural syntax. Uses vue-i18n's own literal-interpolation form `{'x'}`, so the
 * compiled message renders the original character unchanged (round-trips
 * exactly for `@`, `{`, `}`, `|`).
 *
 * Org messages are user-editable text (labels, hints, welcome markdown) that may
 * contain emails (`@`), braces, or pipes. vue-i18n compiles every merged
 * message on `$t()`, and an unescaped `@` (e.g. inside an email address) makes
 * its tokenizer throw a SyntaxError (code 10, parseLinked) at render time →
 * HTTP 500. Escaping is applied transiently at the i18n-merge boundary only and
 * is never persisted to the config, so the editor still shows the raw text.
 */
export function escapeI18nMessage(value: string): string {
  // Each matched char becomes a self-contained `{'x'}` literal unit, so a single
  // replace pass is correct: the inserted braces are consumed by their own
  // literal, and the inner character is never a quote.
  return value.replace(/[@{}|]/g, (c) => `{'${c}'}`)
}

/** Deep-apply {@link escapeI18nMessage} to every string in a messages tree. */
export function escapeI18nMessages<T>(node: T): T {
  if (typeof node === 'string') return escapeI18nMessage(node) as unknown as T
  if (Array.isArray(node)) return node.map(escapeI18nMessages) as unknown as T
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, escapeI18nMessages(v)]),
    ) as unknown as T
  }
  return node
}
