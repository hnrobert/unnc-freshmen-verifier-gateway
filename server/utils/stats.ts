import { createHash } from 'node:crypto'
import { UAParser } from 'ua-parser-js'
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { PageEvent } from '#server/entities/pageEvent.entity'
import { PageDailyStat } from '#server/entities/pageDailyStat.entity'
import { PageVerifiedIdentity } from '#server/entities/pageVerifiedIdentity.entity'
import { Page } from '#server/entities/page.entity'
import { AuditEvent } from '#server/entities/auditEvent.entity'
import { AppSetting } from '#server/entities/appSetting.entity'
import { listAccessiblePages, type EffectiveRole } from './members'

const RETENTION_DAYS = 90
const RANGES = new Set([7, 30, 90, 0]) // 0 == all

/** Stable salt (env override, else the session secret) so hashes are reproducible across restarts. */
function getSalt(): string {
  return process.env.STATS_SALT || process.env.SESSION_SECRET || 'dev-secret-change-me'
}

/** Salted SHA-256; returns null for empty/null input. One-way — never reversible. */
function hash(value: string | null | undefined): string | null {
  if (!value) return null
  return createHash('sha256').update(getSalt()).update(value).digest('hex')
}

/** YYYY-MM-DD in UTC (matches SQLite CURRENT_TIMESTAMP, which is UTC). */
function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Region from an Accept-Language tag like "zh-CN,zh;q=0.9" → "CN". */
function deriveCountry(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null
  const tag = acceptLanguage.split(',')[0]?.trim()
  if (!tag) return null
  const region = tag.split('-')[1]?.toUpperCase()
  if (region && /^[A-Z]{2}$/.test(region)) return region
  return null
}

interface EventMeta {
  ipHash: string | null
  locale: string | null
  country: string | null
  device: string | null
  browser: string | null
  os: string | null
  referer: string | null
}

/** Extract non-PII visitor metadata from the request (UA→device/browser/os, locale, IP+referer hashes). */
export function parseMeta(event: H3Event): EventMeta {
  const ip = getRequestIP(event, { xForwardedFor: true }) || null
  const ua = getRequestHeader(event, 'user-agent') || null
  const acceptLanguage = getRequestHeader(event, 'accept-language') || null
  const referer = getRequestHeader(event, 'referer') || null
  const parsed = ua ? new UAParser(ua).getResult() : null
  const deviceType = parsed?.device?.type
  return {
    ipHash: hash(ip),
    locale: acceptLanguage ? acceptLanguage.split(',')[0]?.trim() || null : null,
    country: deriveCountry(acceptLanguage),
    // UAParser leaves desktop device.type undefined; normalize so the breakdown is useful.
    device: deviceType ?? (ua ? 'desktop' : null),
    browser: parsed?.browser?.name || null,
    os: parsed?.os?.name || null,
    referer: referer && referer !== 'null' ? referer : null,
  }
}

// --- Writers ---

async function bumpRollup(pageId: number, day: string, metrics: string[]): Promise<void> {
  for (const metric of metrics) {
    // SQLite upsert on the unique (org_id, day, metric).
    await AppDataSource.query(
      `INSERT INTO org_daily_stats (org_id, day, metric, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (org_id, day, metric) DO UPDATE SET count = count + 1`,
      [pageId, day, metric],
    )
  }
}

function verifyMetrics(outcome: string, mode: string | null): string[] {
  const metrics = ['verify_total']
  if (outcome === 'admitted') metrics.push('verify_admitted')
  else if (outcome === 'not_found') metrics.push('verify_not_found')
  else if (outcome === 'error') metrics.push('verify_error')
  else if (outcome === 'missing') metrics.push('verify_missing')
  if (mode === 'live') metrics.push('live')
  else if (mode === 'mock') metrics.push('mock')
  else if (mode === 'trusted') metrics.push('trusted')
  return metrics
}

/** Record a page view. Fire-and-forget at the call site (never blocks the response). */
export async function recordView(event: H3Event, pageId: number): Promise<void> {
  const meta = parseMeta(event)
  const day = dayKey()
  try {
    await AppDataSource.getRepository(PageEvent).save({ pageId, type: 'view', ...meta })
    await bumpRollup(pageId, day, ['view'])
    void pruneOldEvents()
  } catch {
    // best-effort — analytics must never break a page render
  }
}

export interface VerifyRecord {
  outcome: string // admitted | not_found | error | missing | mock | trusted
  mode: string | null // live | mock | trusted
  name: string | null
  idHash: string | null
}

/** Record a verification attempt. Fire-and-forget at the call site. */
export async function recordVerify(
  event: H3Event,
  pageId: number,
  rec: VerifyRecord,
): Promise<void> {
  const meta = parseMeta(event)
  const day = dayKey()
  try {
    await AppDataSource.getRepository(PageEvent).save({
      pageId,
      type: 'verify',
      outcome: rec.outcome,
      mode: rec.mode,
      name: rec.name,
      idHash: rec.idHash,
      ...meta,
    })
    await bumpRollup(pageId, day, verifyMetrics(rec.outcome, rec.mode))
    void pruneOldEvents()
    // Mirror every verify attempt into the site-wide audit trail (one funnel for
    // all verify branches). Hoisted — recordAudit is defined further below.
    void recordAudit(event, {
      action: 'verify',
      outcome: rec.outcome,
      pageId,
      actorType: 'anonymous',
      name: rec.name,
      detail: { mode: rec.mode, idHash: rec.idHash },
    })
  } catch {
    // best-effort
  }
}

/** Hash a normalized ID number for storage (call before recordVerify). */
export function hashIdNumber(normalizedId: string): string | null {
  return hash(normalizedId)
}

/**
 * Salted SHA-256 of a visitor's device fingerprint (the `vg_device` cookie +
 * User-Agent). Used to bind the verify JWT to the browser that earned it, so a
 * token issued in one browser can't be replayed to skip verification in another.
 * Like {@link hashIdNumber} it is one-way and stable across restarts.
 */
export function hashDevice(deviceId: string, userAgent: string): string {
  return createHash('sha256')
    .update(getSalt())
    .update(deviceId)
    .update('|')
    .update(userAgent)
    .digest('hex')
}

/**
 * Device fingerprint for the current request. Combines the `vg_device` cookie
 * with the User-Agent; when no cookie is present yet (first request before the
 * client plugin has set it, or cookies blocked) it degrades to a UA-only hash —
 * always returns a string so sign/verify stay consistent across requests.
 */
export function deviceHashFromRequest(event: H3Event): string {
  const deviceId = getCookie(event, 'vg_device') ?? ''
  return hashDevice(deviceId, getRequestHeader(event, 'user-agent') || '')
}

/**
 * Has this name + ID hash already been verified for this page? The "already used"
 * check — answers without re-querying the UNNC portal. Best-effort: on any error
 * returns false (fail open: the caller will simply verify again).
 */
export async function findVerifiedIdentity(
  pageId: number,
  idHash: string | null,
): Promise<boolean> {
  if (!idHash) return false
  try {
    const row = await AppDataSource.getRepository(PageVerifiedIdentity).findOne({
      where: { pageId, idHash },
    })
    return !!row
  } catch {
    return false
  }
}

/**
 * Record a verified identity for (page, idHash) — idempotent. Best-effort, never
 * throws (dedup must not break a verify response). Uses INSERT OR IGNORE so the
 * unique (org_id, id_hash) index makes repeat admits a no-op.
 */
export async function upsertVerifiedIdentity(
  pageId: number,
  name: string,
  idHash: string | null,
): Promise<void> {
  if (!idHash) return
  try {
    await AppDataSource.query(
      'INSERT OR IGNORE INTO org_verified_identities (org_id, name, id_hash) VALUES (?, ?, ?)',
      [pageId, name, idHash],
    )
  } catch {
    // best-effort
  }
}

// Opportunistic retention prune — at most once per 24h per process.
let lastPruneAt = 0
export async function pruneOldEvents(): Promise<void> {
  const now = Date.now()
  if (now - lastPruneAt < 24 * 60 * 60 * 1000) return
  lastPruneAt = now
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await AppDataSource.getRepository(PageEvent)
    .createQueryBuilder()
    .delete()
    .where('createdAt < :cutoff', { cutoff })
    .execute()
}

// --- Audit trail (site-wide, superadmin-visible) ---

export interface AuditRecord {
  action: string
  outcome?: string | null
  pageId?: number | null
  /** default 'anonymous' */
  actorType?: string | null
  userId?: number | null
  email?: string | null
  name?: string | null
  detail?: Record<string, unknown> | null
}

/**
 * Write one audit row. Fire-and-forget at the call site (wrap in `void …`); never
 * throws — audit recording must not break the request it observes. Verification
 * attempts are mirrored here automatically from {@link recordVerify}.
 */
export async function recordAudit(event: H3Event, rec: AuditRecord): Promise<void> {
  try {
    const ipHash = parseMeta(event).ipHash
    await AppDataSource.getRepository(AuditEvent).save({
      action: rec.action,
      outcome: rec.outcome ?? null,
      pageId: rec.pageId ?? null,
      actorType: rec.actorType ?? 'anonymous',
      userId: rec.userId ?? null,
      email: rec.email ?? null,
      name: rec.name ?? null,
      ipHash,
      detail: rec.detail ? JSON.stringify(rec.detail) : null,
    })
    void pruneOldAuditEvents()
  } catch {
    // best-effort — audit must never break the observed request
  }
}

const AUDIT_RETENTION_KEY = 'audit.retentionDays'
const DEFAULT_AUDIT_RETENTION_DAYS = 90
const AUDIT_RETENTION_CACHE_TTL_MS = 30_000
let auditRetentionCache: { t: number; value: number } | null = null

/** Configured audit retention in days (superadmin-tunable; default 90). */
export async function getAuditRetentionDays(): Promise<number> {
  if (auditRetentionCache && Date.now() - auditRetentionCache.t < AUDIT_RETENTION_CACHE_TTL_MS)
    return auditRetentionCache.value
  const row = await AppDataSource.getRepository(AppSetting).findOne({
    where: { key: AUDIT_RETENTION_KEY },
  })
  const value = parseAuditRetention(row?.value)
  auditRetentionCache = { t: Date.now(), value }
  return value
}

/** Persist the audit retention (days) and invalidate the cache. */
export async function setAuditRetentionDays(days: number): Promise<void> {
  await AppDataSource.getRepository(AppSetting).save({
    key: AUDIT_RETENTION_KEY,
    value: JSON.stringify(days),
  })
  auditRetentionCache = null
}

function parseAuditRetention(raw: string | null | undefined): number {
  if (raw == null || raw === '') return DEFAULT_AUDIT_RETENTION_DAYS
  try {
    const n = JSON.parse(raw)
    return Number.isInteger(n) && n >= 1 ? n : DEFAULT_AUDIT_RETENTION_DAYS
  } catch {
    return DEFAULT_AUDIT_RETENTION_DAYS
  }
}

// Opportunistic audit retention prune — at most once per 24h per process.
let lastAuditPruneAt = 0
export async function pruneOldAuditEvents(): Promise<void> {
  const now = Date.now()
  if (now - lastAuditPruneAt < 24 * 60 * 60 * 1000) return
  lastAuditPruneAt = now
  const days = await getAuditRetentionDays()
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
  await AppDataSource.getRepository(AuditEvent)
    .createQueryBuilder()
    .delete()
    .where('createdAt < :cutoff', { cutoff })
    .execute()
}

export interface AuditQuery {
  action?: string | null
  outcome?: string | null
  pageId?: number | null
  userId?: number | null
  search?: string | null
  from?: string | null
  to?: string | null
  limit?: number
  offset?: number
}

export interface AuditRow {
  id: number
  createdAt: string
  pageId: number | null
  pageName: string | null
  action: string
  outcome: string | null
  actorType: string | null
  userId: number | null
  email: string | null
  name: string | null
  detail: Record<string, unknown> | null
}

/**
 * Read the site-wide audit trail with filters + pagination (newest first).
 * Powers GET /api/admin/audit. Page names are resolved in a second query so a
 * superadmin sees a human label even for pages they don't own.
 */
export async function readAudit(q: AuditQuery): Promise<{ events: AuditRow[]; total: number }> {
  const limit = Math.min(Math.max(q.limit ?? 100, 1), 500)
  const offset = Math.max(q.offset ?? 0, 0)
  const qb = AppDataSource.getRepository(AuditEvent).createQueryBuilder('a')
  if (q.action) qb.andWhere('a.action = :action', { action: q.action })
  if (q.outcome) qb.andWhere('a.outcome = :outcome', { outcome: q.outcome })
  if (q.pageId != null) qb.andWhere('a.pageId = :pageId', { pageId: q.pageId })
  if (q.userId != null) qb.andWhere('a.userId = :userId', { userId: q.userId })
  if (q.from) qb.andWhere('a.createdAt >= :from', { from: q.from })
  if (q.to) qb.andWhere('a.createdAt <= :to', { to: q.to })
  if (q.search) qb.andWhere('(a.email LIKE :s OR a.name LIKE :s)', { s: `%${q.search}%` })

  const [rows, total] = await Promise.all([
    qb
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany(),
    qb.getCount(),
  ])

  const pageIds = Array.from(
    new Set(rows.map((r) => r.pageId).filter((v): v is number => v != null)),
  )
  const pageMap = new Map<number, string>()
  if (pageIds.length) {
    const pages = await AppDataSource.getRepository(Page).find({
      where: pageIds.map((id) => ({ id })),
      select: { id: true, name: true },
    })
    for (const o of pages) pageMap.set(o.id, o.name)
  }

  return {
    total,
    events: rows.map((r) => ({
      id: r.id,
      createdAt: new Date(r.createdAt).toISOString(),
      pageId: r.pageId,
      pageName: (r.pageId != null && pageMap.get(r.pageId)) || null,
      action: r.action,
      outcome: r.outcome,
      actorType: r.actorType,
      userId: r.userId,
      email: r.email,
      name: r.name,
      detail: r.detail ? safeParseDetail(r.detail) : null,
    })),
  }
}

function safeParseDetail(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// --- Reader (powers GET /api/pages/<slug>/stats) ---

function rangeDays(value: unknown): number {
  const n = Number(value)
  return RANGES.has(n) ? n : 30
}

/** Continuous list of 'YYYY-MM-DD' days from start..today (UTC), inclusive. */
function dayRange(start: string): string[] {
  const out: string[] = []
  const end = new Date()
  for (let d = new Date(start + 'T00:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function topCount(rows: { key: string | null; count: number }[], limit = 8) {
  return rows
    .filter((r) => r.key)
    .slice(0, limit)
    .map((r) => ({ key: r.key as string, count: r.count }))
}

export interface StatsResult {
  range: number
  totals: {
    views: number
    uniqueVisitors: number
    verifyTotal: number
    admitted: number
    notFound: number
    error: number
    missing: number
    successRate: number | null
  }
  daily: {
    days: string[]
    views: number[]
    uniqueVisitors: (number | null)[]
    verifyTotal: number[]
    admitted: number[]
    notFound: number[]
    error: number[]
  }
  breakdowns: {
    outcome: { key: string; count: number }[]
    mode: { key: string; count: number }[]
    locale: { key: string; count: number }[]
    country: { key: string; count: number }[]
    device: { key: string; count: number }[]
    browser: { key: string; count: number }[]
    os: { key: string; count: number }[]
    referer: { key: string; count: number }[]
  }
}

export async function readStats(pageId: number, rangeQuery: unknown): Promise<StatsResult> {
  const range = rangeDays(rangeQuery)
  const now = Date.now()
  const sinceMs = range > 0 ? now - range * 24 * 60 * 60 * 1000 : 0
  const since = sinceMs ? new Date(sinceMs).toISOString() : null
  const startDay = sinceMs ? new Date(sinceMs).toISOString().slice(0, 10) : '1970-01-01'
  const days = range > 0 ? dayRange(startDay) : []

  const eventRepo = AppDataSource.getRepository(PageEvent)
  const statRepo = AppDataSource.getRepository(PageDailyStat)

  // --- rollup rows in range (range>0: per-day series; all-time: per-metric totals) ---
  const rollups =
    range > 0
      ? await statRepo
          .createQueryBuilder('s')
          .select(['s.day AS day', 's.metric AS metric', 's.count AS count'])
          .where('s.pageId = :pageId', { pageId })
          .andWhere('s.day >= :startDay', { startDay })
          .getRawMany<{ day: string; metric: string; count: number }>()
      : await statRepo
          .createQueryBuilder('s')
          .select(['s.metric AS metric', 'SUM(s.count) AS count'])
          .where('s.pageId = :pageId', { pageId })
          .groupBy('s.metric')
          .getRawMany<{ metric: string; count: number }>()

  const metricByDay = new Map<string, Record<string, number>>() // day -> metric -> count
  const metricTotals = new Map<string, number>()
  for (const r of rollups as { day?: string; metric: string; count: number }[]) {
    metricTotals.set(r.metric, (metricTotals.get(r.metric) ?? 0) + Number(r.count))
    if (r.day) {
      const m = metricByDay.get(r.day) ?? {}
      m[r.metric] = (m[r.metric] ?? 0) + Number(r.count)
      metricByDay.set(r.day, m)
    }
  }

  const pickDay = (metric: string) => days.map((d) => metricByDay.get(d)?.[metric] ?? 0)

  // --- unique visitors (from raw events; only within 90-day retention) ---
  const retentionCutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const uvSince = since && since > retentionCutoff ? since : retentionCutoff
  const uvByDayRows = await eventRepo
    .createQueryBuilder('e')
    .select(['DATE(e.createdAt) AS day', 'COUNT(DISTINCT e.ipHash) AS uv'])
    .where('e.pageId = :pageId', { pageId })
    .andWhere('e.type = :type', { type: 'view' })
    .andWhere('e.createdAt >= :uvSince', { uvSince })
    .groupBy('DATE(e.createdAt)')
    .getRawMany<{ day: string; uv: number }>()
  const uvByDay = new Map(uvByDayRows.map((r) => [r.day, Number(r.uv)]))
  const uvSeries: (number | null)[] = days.map((d) => {
    const v = uvByDay.get(d)
    return v === undefined ? null : v
  })

  // total unique visitors in range (cap by retention)
  const uniqueVisitors =
    range > 0
      ? uvByDayRows.reduce((a, r) => a + Number(r.uv), 0)
      : Number(
          (
            await eventRepo
              .createQueryBuilder('e')
              .select('COUNT(DISTINCT e.ipHash)', 'uv')
              .where('e.pageId = :pageId', { pageId })
              .andWhere('e.type = :type', { type: 'view' })
              .andWhere('e.createdAt >= :uvSince', { uvSince })
              .getRawOne<{ uv: number }>()
          )?.uv ?? 0,
        )

  // --- breakdowns from raw events in range ---
  const eventSince = (qb: ReturnType<typeof eventRepo.createQueryBuilder>) =>
    since ? qb.andWhere('e.createdAt >= :since', { since }) : qb

  const breakdown = async (col: string) => {
    let qb = eventRepo
      .createQueryBuilder('e')
      .select([`e.${col} AS key`, 'COUNT(*) AS count'])
      .where('e.pageId = :pageId', { pageId })
    qb = eventSince(qb)
    const rows = await qb
      .groupBy(`e.${col}`)
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany<{ key: string | null; count: number }>()
    return topCount(rows)
  }

  const verifyTotal = metricTotals.get('verify_total') ?? 0
  const admitted = metricTotals.get('verify_admitted') ?? 0
  const successRate = verifyTotal > 0 ? admitted / verifyTotal : null

  return {
    range,
    totals: {
      views: metricTotals.get('view') ?? 0,
      uniqueVisitors,
      verifyTotal,
      admitted,
      notFound: metricTotals.get('verify_not_found') ?? 0,
      error: metricTotals.get('verify_error') ?? 0,
      missing: metricTotals.get('verify_missing') ?? 0,
      successRate,
    },
    daily: {
      days,
      views: pickDay('view'),
      uniqueVisitors: uvSeries,
      verifyTotal: pickDay('verify_total'),
      admitted: pickDay('verify_admitted'),
      notFound: pickDay('verify_not_found'),
      error: pickDay('verify_error'),
    },
    breakdowns: {
      outcome: await breakdown('outcome'),
      mode: await breakdown('mode'),
      locale: await breakdown('locale'),
      country: await breakdown('country'),
      device: await breakdown('device'),
      browser: await breakdown('browser'),
      os: await breakdown('os'),
      referer: await breakdown('referer'),
    },
  }
}

// --- Cross-page overview (powers GET /api/stats/overview → dashboard 看板) ---

export interface OverviewPage {
  id: number
  slug: string
  name: string
  role: EffectiveRole
  totals: { views: number; verifyTotal: number; admitted: number; successRate: number | null }
  /** Daily views across the range, aligned to `daily.days` (for the sparkline). */
  spark: number[]
}

export interface OverviewResult {
  range: number
  totals: {
    views: number
    uniqueVisitors: number
    verifyTotal: number
    admitted: number
    notFound: number
    error: number
    successRate: number | null
  }
  daily: {
    days: string[]
    views: number[]
    uniqueVisitors: (number | null)[]
    verifyTotal: number[]
    admitted: number[]
  }
  pages: OverviewPage[]
}

/**
 * Aggregate stats across a set of pages, for the dashboard 看板: cross-page totals
 * + a summed daily trend + a per-page breakdown (each page's quick KPIs + a views
 * sparkline). UV is a true `COUNT(DISTINCT ip_hash)` across all the pages (a
 * visitor shared between pages isn't double counted — the stats salt is stable
 * across pages).
 */
async function aggregateOverview(
  accessible: { page: Page; role: EffectiveRole }[],
  rangeQuery: unknown,
): Promise<OverviewResult> {
  const range = rangeDays(rangeQuery)
  const now = Date.now()
  const sinceMs = range > 0 ? now - range * 24 * 60 * 60 * 1000 : 0
  const since = sinceMs ? new Date(sinceMs).toISOString() : null
  const startDay = sinceMs ? new Date(sinceMs).toISOString().slice(0, 10) : '1970-01-01'
  const days = range > 0 ? dayRange(startDay) : []

  const empty: OverviewResult = {
    range,
    totals: {
      views: 0,
      uniqueVisitors: 0,
      verifyTotal: 0,
      admitted: 0,
      notFound: 0,
      error: 0,
      successRate: null,
    },
    daily: { days, views: [], uniqueVisitors: [], verifyTotal: [], admitted: [] },
    pages: [],
  }
  if (!accessible.length) return empty

  const pageIds = accessible.map((a) => a.page.id)
  const statRepo = AppDataSource.getRepository(PageDailyStat)
  const eventRepo = AppDataSource.getRepository(PageEvent)

  // --- aggregate totals across pages ---
  const totalRows = await statRepo
    .createQueryBuilder('s')
    .select(['s.metric AS metric', 'SUM(s.count) AS count'])
    .where('s.pageId IN (:...pageIds)', { pageIds })
    .groupBy('s.metric')
    .getRawMany<{ metric: string; count: number }>()
  const metricTotals = new Map<string, number>()
  for (const r of totalRows)
    metricTotals.set(r.metric, (metricTotals.get(r.metric) ?? 0) + Number(r.count))

  // --- aggregate daily trend across pages ---
  const metricByDay = new Map<string, Record<string, number>>()
  if (range > 0) {
    const dailyRows = await statRepo
      .createQueryBuilder('s')
      .select(['s.day AS day', 's.metric AS metric', 'SUM(s.count) AS count'])
      .where('s.pageId IN (:...pageIds)', { pageIds })
      .andWhere('s.day >= :startDay', { startDay })
      .groupBy('s.day')
      .addGroupBy('s.metric')
      .getRawMany<{ day: string; metric: string; count: number }>()
    for (const r of dailyRows) {
      const m = metricByDay.get(r.day) ?? {}
      m[r.metric] = (m[r.metric] ?? 0) + Number(r.count)
      metricByDay.set(r.day, m)
    }
  }
  const pickDay = (metric: string) => days.map((d) => metricByDay.get(d)?.[metric] ?? 0)

  // --- cross-page unique visitors (distinct ip_hash across all the pages) ---
  const retentionCutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const uvSince = since && since > retentionCutoff ? since : retentionCutoff
  let uvSeries: (number | null)[] = days.map(() => null)
  let uniqueVisitors = 0
  if (range > 0) {
    const uvRows = await eventRepo
      .createQueryBuilder('e')
      .select(['DATE(e.createdAt) AS day', 'COUNT(DISTINCT e.ipHash) AS uv'])
      .where('e.pageId IN (:...pageIds)', { pageIds })
      .andWhere('e.type = :type', { type: 'view' })
      .andWhere('e.createdAt >= :uvSince', { uvSince })
      .groupBy('DATE(e.createdAt)')
      .getRawMany<{ day: string; uv: number }>()
    const uvByDay = new Map(uvRows.map((r) => [r.day, Number(r.uv)]))
    uvSeries = days.map((d) => {
      const v = uvByDay.get(d)
      return v === undefined ? null : v
    })
    uniqueVisitors = uvRows.reduce((a, r) => a + Number(r.uv), 0)
  } else {
    uniqueVisitors = Number(
      (
        await eventRepo
          .createQueryBuilder('e')
          .select('COUNT(DISTINCT e.ipHash)', 'uv')
          .where('e.pageId IN (:...pageIds)', { pageIds })
          .andWhere('e.type = :type', { type: 'view' })
          .andWhere('e.createdAt >= :uvSince', { uvSince })
          .getRawOne<{ uv: number }>()
      )?.uv ?? 0,
    )
  }

  // --- per-page totals ---
  const perPageTotals = await statRepo
    .createQueryBuilder('s')
    .select(['s.pageId AS pageId', 's.metric AS metric', 'SUM(s.count) AS count'])
    .where('s.pageId IN (:...pageIds)', { pageIds })
    .groupBy('s.pageId')
    .addGroupBy('s.metric')
    .getRawMany<{ pageId: number; metric: string; count: number }>()
  const perPage = new Map<number, Record<string, number>>()
  for (const r of perPageTotals) {
    const m = perPage.get(r.pageId) ?? {}
    m[r.metric] = (m[r.metric] ?? 0) + Number(r.count)
    perPage.set(r.pageId, m)
  }

  // --- per-page daily views for the sparkline ---
  const perPageSpark = new Map<number, number[]>()
  if (range > 0) {
    const sparkRows = await statRepo
      .createQueryBuilder('s')
      .select(['s.pageId AS pageId', 's.day AS day', 'SUM(s.count) AS count'])
      .where('s.pageId IN (:...pageIds)', { pageIds })
      .andWhere('s.metric = :metric', { metric: 'view' })
      .andWhere('s.day >= :startDay', { startDay })
      .groupBy('s.pageId')
      .addGroupBy('s.day')
      .getRawMany<{ pageId: number; day: string; count: number }>()
    const sparkMap = new Map<number, Map<string, number>>()
    for (const r of sparkRows) {
      const d = sparkMap.get(r.pageId) ?? new Map<string, number>()
      d.set(r.day, Number(r.count))
      sparkMap.set(r.pageId, d)
    }
    for (const id of pageIds) {
      const d = sparkMap.get(id)
      perPageSpark.set(
        id,
        days.map((day) => d?.get(day) ?? 0),
      )
    }
  }

  const verifyTotal = metricTotals.get('verify_total') ?? 0
  const admitted = metricTotals.get('verify_admitted') ?? 0

  const pages: OverviewPage[] = accessible
    .map(({ page, role }) => {
      const m = perPage.get(page.id) ?? {}
      const v = m['verify_total'] ?? 0
      const adm = m['verify_admitted'] ?? 0
      return {
        id: page.id,
        slug: page.slug,
        name: page.name,
        role,
        totals: {
          views: m['view'] ?? 0,
          verifyTotal: v,
          admitted: adm,
          successRate: v > 0 ? adm / v : null,
        },
        spark: perPageSpark.get(page.id) ?? [],
      }
    })
    .sort((a, b) => b.totals.views - a.totals.views)

  return {
    range,
    totals: {
      views: metricTotals.get('view') ?? 0,
      uniqueVisitors,
      verifyTotal,
      admitted,
      notFound: metricTotals.get('verify_not_found') ?? 0,
      error: metricTotals.get('verify_error') ?? 0,
      successRate: verifyTotal > 0 ? admitted / verifyTotal : null,
    },
    daily: {
      days,
      views: pickDay('view'),
      uniqueVisitors: uvSeries,
      verifyTotal: pickDay('verify_total'),
      admitted: pickDay('verify_admitted'),
    },
    pages,
  }
}

/** Dashboard overview for a single user — aggregates their accessible pages. */
export async function readOverviewStats(
  userId: number,
  rangeQuery: unknown,
): Promise<OverviewResult> {
  return aggregateOverview(await listAccessiblePages(userId), rangeQuery)
}

/** Site-wide overview for the admin panel — aggregates EVERY page. */
export async function readOverviewStatsAll(rangeQuery: unknown): Promise<OverviewResult> {
  const all = await AppDataSource.getRepository(Page).find()
  return aggregateOverview(
    all.map((page) => ({ page, role: 'superadmin' as EffectiveRole })),
    rangeQuery,
  )
}
