import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { isSecureRequest } from './request'

const CHALLENGE_COOKIE = 'vg_pk_challenge'
const CHALLENGE_TTL_S = 5 * 60 // 5 minutes — generous enough for an authenticator prompt
const RP_NAME = 'UNNC Freshmen Verifier Gateway'

/**
 * The Relying Party the browser/authenticator sees. Derived per-request so
 * passkeys work on `localhost`, HTTPS tunnels (ngrok/frp/Cloudflare), and prod
 * domains alike — the credential is scoped to the host the visitor actually
 * reached. Override via `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` when a proxy makes
 * the server's view of its own host differ from the public origin.
 *
 * (WebAuthn still requires a secure context, so this is only useful over HTTPS
 * or `http://localhost` — plain-HTTP tunnels can't create/use passkeys.)
 */
export function getRelyingParty(event: H3Event): { rpID: string; rpName: string; origin: string } {
  const xfh = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
  const hostHeader = getRequestHeader(event, 'host') ?? ''
  const host = (xfh || hostHeader).replace(/:\d+$/, '')
  const rpID = process.env.WEBAUTHN_RP_ID || host || 'localhost'
  const proto = isSecureRequest(event) ? 'https' : 'http'
  const origin = process.env.WEBAUTHN_ORIGIN || `${proto}://${rpID}`
  return { rpID, rpName: RP_NAME, origin }
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me'
}

/** HMAC-sign a challenge so a tampered cookie is rejected. Format `<challenge>.<sig>`. */
function signChallenge(challenge: string): string {
  const sig = createHmac('sha256', getSecret()).update(challenge).digest('hex')
  return `${challenge}.${sig}`
}

/** Store the options challenge in a short-lived signed cookie (stateless; no DB row). */
export function setChallengeCookie(event: H3Event, challenge: string): void {
  setCookie(event, CHALLENGE_COOKIE, signChallenge(challenge), {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: CHALLENGE_TTL_S, secure: isSecureRequest(event),
  })
}

/** Returns the stored challenge if the cookie signature verifies, else null. */
export function getChallengeCookie(event: H3Event): string | null {
  const raw = getCookie(event, CHALLENGE_COOKIE)
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const challenge = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', getSecret()).update(challenge).digest('hex')
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && timingSafeEqual(a, b) ? challenge : null
}

/** Always clear after a verify attempt (success or failure) to prevent replay. */
export function clearChallengeCookie(event: H3Event): void {
  deleteCookie(event, CHALLENGE_COOKIE, { path: '/' })
}

/** Parse the stored transports JSON back into the typed array (empty if absent/invalid). */
export function parseTransports(stored: string | null): AuthenticatorTransportFuture[] {
  if (!stored) return []
  try {
    const arr = JSON.parse(stored) as unknown
    return Array.isArray(arr) ? (arr as AuthenticatorTransportFuture[]) : []
  } catch {
    return []
  }
}

/**
 * better-sqlite3 returns a Node `Buffer` for a blob column. SimpleWebAuthn wants
 * a `Uint8Array<ArrayBuffer>`. Copying into a freshly-allocated Uint8Array (a)
 * detaches from any larger shared ArrayBuffer the Buffer may view into, and
 * (b) satisfies the lib's `ArrayBuffer`-backed type parameter.
 */
export function bufferToUint8(buf: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(buf.byteLength)
  out.set(buf)
  return out
}

/**
 * Stable, unique WebAuthn userHandle (bytes) for an internal user id. The
 * library rejects raw string userIDs; encoding the numeric id avoids an extra
 * column on `users`. Returns an ArrayBuffer-backed Uint8Array as the v13
 * `userID` opts field expects.
 */
export function webauthnUserId(userId: number): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(String(userId))
  const out = new Uint8Array(buf.byteLength)
  out.set(buf)
  return out
}
