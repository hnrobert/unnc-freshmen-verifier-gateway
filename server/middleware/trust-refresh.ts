import { refreshVerifyCookie } from '#server/utils/jwt'

/**
 * Sliding trust renewal: any request carrying a still-valid visitor-trust
 * cookie (vg_verify) gets it re-issued with a fresh full window. The trust
 * therefore survives as long as the browser returns within one TTL of its
 * last visit, and expires naturally after that. Runs after the session
 * middleware (filename order) and is a cheap no-op without a cookie.
 */
export default defineEventHandler((event) => {
  refreshVerifyCookie(event)
})
