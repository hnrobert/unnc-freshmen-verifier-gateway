import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import type { AdmissionResult } from '#shared/types'
import { isSecureRequest } from './request'

const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
/** Email-code verification grants a longer trust window (admin-chosen flow). */
export const EMAIL_TRUST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const LOGIN_COOKIE = 'vg_jwt' // issued on website login (userId-based)
const VERIFY_COOKIE = 'vg_verify' // issued on successful portal check (name+ID-based)

// --- Login trust JWT (for registered website users) ---

export interface LoginTrustPayload {
  userId: number
  email: string
  trustedUntil: string
}

export function getTrustWindowMs(): number {
  return TRUST_WINDOW_MS
}

export function signTrustJwt(userId: number, email: string, trustedUntil: Date): string {
  return jwt.sign(
    { userId, email, trustedUntil: trustedUntil.toISOString() } satisfies LoginTrustPayload,
    getSecret(),
    { expiresIn: `${TRUST_WINDOW_MS / 1000}s` },
  )
}

export function verifyTrustJwt(event: H3Event): LoginTrustPayload | null {
  const token = getCookie(event, LOGIN_COOKIE)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret()) as LoginTrustPayload
  } catch {
    return null
  }
}

export function setTrustCookie(event: H3Event, token: string): void {
  setCookie(event, LOGIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRUST_WINDOW_MS / 1000,
    secure: isSecureRequest(event),
  })
}

export function clearTrustCookie(event: H3Event): void {
  deleteCookie(event, LOGIN_COOKIE, { path: '/' })
}

// --- Verify trust JWT (for anonymous visitors — name + ID-hash + device) ---
//
// Privacy: the payload carries only the salted SHA-256 `idHash` (never the raw
// ID number) plus a `deviceHash` binding the token to the browser that earned
// it. `admission` is cached so a trusted visitor can be fast-tracked to another
// page's welcome page without re-querying the portal.

export interface VerifyTrustPayload {
  name: string
  idHash: string
  deviceHash: string
  trustedUntil: string
  /** Cached portal result so a cross-page skip can render the welcome page. */
  admission?: AdmissionResult
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me'
}

export function signVerifyJwt(
  name: string,
  idHash: string,
  deviceHash: string,
  admission?: AdmissionResult,
  /** Trust-window override (defaults to 7d); the email-code flow passes 30d. */
  ttlMs: number = TRUST_WINDOW_MS,
): string {
  const trustedUntil = new Date(Date.now() + ttlMs).toISOString()
  return jwt.sign(
    { name, idHash, deviceHash, trustedUntil, admission } satisfies VerifyTrustPayload,
    getSecret(),
    { expiresIn: `${ttlMs / 1000}s` },
  )
}

export function verifyVerifyJwt(event: H3Event): (VerifyTrustPayload & { iat?: number }) | null {
  const token = getCookie(event, VERIFY_COOKIE)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret()) as VerifyTrustPayload & { iat?: number }
  } catch {
    return null
  }
}

/**
 * Sliding-renewal: while the trust cookie is still VALID, every request
 * re-issues it with a fresh full window — so the trust lives as long as the
 * browser keeps visiting within one TTL of its last visit, and lapses only
 * after a gap longer than that. The original TTL is inferred from the token
 * (trustedUntil − issued-at), so 7-day freshman grants and 30-day email grants
 * both slide by their own window. No-op when there is no cookie / it's expired
 * (an expired token must NOT be resurrectable).
 */
export function refreshVerifyCookie(event: H3Event): void {
  const payload = verifyVerifyJwt(event)
  if (!payload?.iat || !payload.trustedUntil) return
  const ttlMs = new Date(payload.trustedUntil).getTime() - payload.iat * 1000
  if (!(ttlMs > 0)) return
  // Already at a full window (just issued)? Skip the re-sign.
  const now = Date.now()
  if (new Date(payload.trustedUntil).getTime() - now > ttlMs - 60_000) return
  const token = signVerifyJwt(
    payload.name,
    payload.idHash,
    payload.deviceHash,
    payload.admission,
    ttlMs,
  )
  setVerifyCookie(event, token, ttlMs)
}

export function setVerifyCookie(
  event: H3Event,
  token: string,
  ttlMs: number = TRUST_WINDOW_MS,
): void {
  setCookie(event, VERIFY_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ttlMs / 1000,
    secure: isSecureRequest(event),
  })
}

export function clearVerifyCookie(event: H3Event): void {
  deleteCookie(event, VERIFY_COOKIE, { path: '/' })
}
