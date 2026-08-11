/**
 * Ensures every browser carries a stable `vg_device` cookie — a random ID used
 * (together with the User-Agent, salted-hashed server-side) to bind the verify
 * JWT to the browser that earned it. This is what lets a visitor who verified in
 * one org skip the form in another org on the SAME browser, while a stolen token
 * alone won't work on a different browser/device.
 *
 * Client-only: the ID is generated and stored in the browser. It rides on every
 * request automatically; the server reads it via `getCookie(event, 'vg_device')`.
 */
const DEVICE_COOKIE = 'vg_device'

function uuid(): string {
  // crypto.randomUUID needs a secure context (localhost/https) — fall back to a
  // RFC-4122-v4-shaped id when it's unavailable so the feature still works.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default defineNuxtPlugin(() => {
  const cookie = useCookie<string>(DEVICE_COOKIE, {
    maxAge: 60 * 60 * 24 * 365, // 1 year — survives reopens; the JWT itself is 7-day
    sameSite: 'lax',
    path: '/',
  })
  if (!cookie.value) cookie.value = uuid()
})
