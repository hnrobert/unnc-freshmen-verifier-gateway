import { argon2id } from '@noble/hashes/argon2.js'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { sessions, users } from '../db/schema'

// argon2id — OWASP-ish params (m=19 MiB, t=2, p=1). Pure JS (@noble/hashes), no native build.
const ARGON_OPTS = { t: 2, m: 19456, p: 1 } as const

/** Hash a password → `saltHex:hashHex` for storage. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = argon2id(Buffer.from(password), salt, ARGON_OPTS)
  return `${salt.toString('hex')}:${Buffer.from(hash).toString('hex')}`
}

/** Verify a password against a stored `saltHex:hashHex`. Constant-time. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = argon2id(Buffer.from(password), Buffer.from(saltHex, 'hex'), ARGON_OPTS)
  const a = Buffer.from(hash)
  const b = Buffer.from(hashHex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/* -------------------------------------------------------------- sessions -- */

const SESSION_COOKIE = 'vg_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface SessionUser {
  id: string
  email: string
}

/** Create a session row + set the cookie. Returns the session id. */
export function createSession(event: H3Event, userId: string): string {
  const id = randomBytes(32).toString('hex')
  const expiresAt = Math.floor((Date.now() + SESSION_TTL_MS) / 1000)
  useDB().insert(sessions).values({ id, userId, expiresAt }).run()
  setCookie(event, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + SESSION_TTL_MS),
    secure: !import.meta.dev,
  })
  return id
}

/** Delete the session row (if any) + clear the cookie. */
export function clearAuthSession(event: H3Event): void {
  const sid = getCookie(event, SESSION_COOKIE)
  if (sid) useDB().delete(sessions).where(eq(sessions.id, sid)).run()
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/** Resolve the current user from the session cookie, or null. */
export function getSessionUser(event: H3Event): SessionUser | null {
  const sid = getCookie(event, SESSION_COOKIE)
  if (!sid) return null
  const row = useDB().select().from(sessions).where(eq(sessions.id, sid)).all()[0]
  if (!row) return null
  if (row.expiresAt * 1000 < Date.now()) {
    useDB().delete(sessions).where(eq(sessions.id, sid)).run()
    return null
  }
  const u = useDB().select().from(users).where(eq(users.id, row.userId)).all()[0]
  if (!u) return null
  return { id: u.id, email: u.email }
}

/** Throw 401 if not authenticated; otherwise return the user. */
export function requireAuth(event: H3Event): SessionUser {
  const user = event.context.user as SessionUser | undefined
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return user
}
