import type { H3Event } from 'h3'

/**
 * True when the client's connection to us is HTTPS — either the socket itself
 * is encrypted, or a TLS-terminating proxy/tunnel (ngrok, Cloudflare, frp, …)
 * forwarded the request to us over plain HTTP with X-Forwarded-Proto: https.
 *
 * Used for the Secure flag on auth cookies. Hardcoding `secure: true` in
 * production drops the cookie over an HTTP tunnel/localhost, so the browser
 * never sends it back and every post-login request 401s. Tying the flag to the
 * real scheme keeps Secure on genuine HTTPS while still authenticating over
 * HTTP tunnels.
 */
export function isSecureRequest(event: H3Event): boolean {
  const xfp = getRequestHeader(event, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()
  if (xfp) return xfp === 'https'
  return Boolean(event.node.req.socket?.encrypted)
}
