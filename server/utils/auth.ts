import { argon2id } from '@noble/hashes/argon2.js'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { isSecureRequest } from './request'
import { Session } from '../entities/session.entity'
import { User } from '../entities/user.entity'

const ARGON_OPTS = { t: 2, m: 19456, p: 1 } as const
const SESSION_COOKIE = 'vg_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

export interface SessionUser { id: number; email: string; role: string }

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = argon2id(Buffer.from(password), salt, ARGON_OPTS)
  return `${salt.toString('hex')}:${Buffer.from(hash).toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = argon2id(Buffer.from(password), Buffer.from(saltHex, 'hex'), ARGON_OPTS)
  const a = Buffer.from(hash)
  const b = Buffer.from(hashHex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function createSession(event: H3Event, userId: number): Promise<string> {
  const id = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await AppDataSource.getRepository(Session).insert({ id, userId, expiresAt })
  setCookie(event, SESSION_COOKIE, id, {
    httpOnly: true, sameSite: 'lax', path: '/',
    expires: expiresAt, secure: isSecureRequest(event),
  })
  return id
}

export async function clearAuthSession(event: H3Event): Promise<void> {
  const sid = getCookie(event, SESSION_COOKIE)
  if (sid) await AppDataSource.getRepository(Session).delete({ id: sid })
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const sid = getCookie(event, SESSION_COOKIE)
  if (!sid) return null
  const sessionRepo = AppDataSource.getRepository(Session)
  const session = await sessionRepo.findOne({ where: { id: sid } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await sessionRepo.delete({ id: sid })
    return null
  }
  const user = await AppDataSource.getRepository(User).findOne({ where: { id: session.userId } })
  if (!user) return null
  return { id: user.id, email: user.email, role: user.role }
}

export function requireAuth(event: H3Event): SessionUser {
  const user = event.context.user as SessionUser | undefined
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return user
}

export function requireSuperAdmin(event: H3Event): SessionUser {
  const user = requireAuth(event)
  if (user.role !== 'superadmin') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}
