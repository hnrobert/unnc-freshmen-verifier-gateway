import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import { isSecureRequest } from './request'

const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const LOGIN_COOKIE = 'vg_jwt'       // issued on website login (userId-based)
const VERIFY_COOKIE = 'vg_verify'   // issued on successful portal check (name+ID-based)

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
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: TRUST_WINDOW_MS / 1000, secure: isSecureRequest(event),
  })
}

export function clearTrustCookie(event: H3Event): void {
  deleteCookie(event, LOGIN_COOKIE, { path: '/' })
}

// --- Verify trust JWT (for anonymous visitors — name+ID based) ---

export interface VerifyTrustPayload {
  name: string
  idNumber: string
  trustedUntil: string
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me'
}

export function signVerifyJwt(name: string, idNumber: string): string {
  const trustedUntil = new Date(Date.now() + TRUST_WINDOW_MS).toISOString()
  return jwt.sign(
    { name, idNumber, trustedUntil } satisfies VerifyTrustPayload,
    getSecret(),
    { expiresIn: `${TRUST_WINDOW_MS / 1000}s` },
  )
}

export function verifyVerifyJwt(event: H3Event): VerifyTrustPayload | null {
  const token = getCookie(event, VERIFY_COOKIE)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret()) as VerifyTrustPayload
  } catch {
    return null
  }
}

export function setVerifyCookie(event: H3Event, token: string): void {
  setCookie(event, VERIFY_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: TRUST_WINDOW_MS / 1000, secure: isSecureRequest(event),
  })
}

export function clearVerifyCookie(event: H3Event): void {
  deleteCookie(event, VERIFY_COOKIE, { path: '/' })
}
