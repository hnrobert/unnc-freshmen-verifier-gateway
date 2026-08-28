/**
 * Dark-or-light foreground pick for a hex background, by perceived luminance.
 * Used wherever a page/org brand color becomes `--primary` and the text on it
 * must stay readable (public page root, org dashboard wrapper).
 */
export function contrastFg(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#1c1917'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1c1917' : '#fafafa'
}
