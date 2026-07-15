import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const COOKIE = 'vg_jwt'

export interface TrustPayload {
  userId: number
  email: string
  trustedUntil: string // ISO date
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me'
}

export function getTrustWindowMs(): number {
  return TRUST_WINDOW_MS
}

export function signTrustJwt(userId: number, email: string, trustedUntil: Date): string {
  return jwt.sign(
    { userId, email, trustedUntil: trustedUntil.toISOString() } satisfies TrustPayload,
    getSecret(),
    { expiresIn: `${TRUST_WINDOW_MS / 1000}s` },
  )
}

export function verifyTrustJwt(event: H3Event): TrustPayload | null {
  const token = getCookie(event, COOKIE)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret()) as TrustPayload
  } catch {
    return null
  }
}

export function setTrustCookie(event: H3Event, token: string): void {
  setCookie(event, COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRUST_WINDOW_MS / 1000,
    secure: !import.meta.dev,
  })
}

export function clearTrustCookie(event: H3Event): void {
  deleteCookie(event, COOKIE, { path: '/' })
}
