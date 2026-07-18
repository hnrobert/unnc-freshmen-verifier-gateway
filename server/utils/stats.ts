import { createHash } from 'node:crypto'
import { UAParser } from 'ua-parser-js'
import type { H3Event } from 'h3'
import { AppDataSource } from './database'
import { OrgEvent } from '../entities/orgEvent.entity'
import { OrgDailyStat } from '../entities/orgDailyStat.entity'

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

async function bumpRollup(orgId: number, day: string, metrics: string[]): Promise<void> {
  for (const metric of metrics) {
    // SQLite upsert on the unique (org_id, day, metric).
    await AppDataSource.query(
      `INSERT INTO org_daily_stats (org_id, day, metric, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (org_id, day, metric) DO UPDATE SET count = count + 1`,
      [orgId, day, metric],
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
export async function recordView(event: H3Event, orgId: number): Promise<void> {
  const meta = parseMeta(event)
  const day = dayKey()
  try {
    await AppDataSource.getRepository(OrgEvent).save({ orgId, type: 'view', ...meta })
    await bumpRollup(orgId, day, ['view'])
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
  orgId: number,
  rec: VerifyRecord,
): Promise<void> {
  const meta = parseMeta(event)
  const day = dayKey()
  try {
    await AppDataSource.getRepository(OrgEvent).save({
      orgId,
      type: 'verify',
      outcome: rec.outcome,
      mode: rec.mode,
      name: rec.name,
      idHash: rec.idHash,
      ...meta,
    })
    await bumpRollup(orgId, day, verifyMetrics(rec.outcome, rec.mode))
    void pruneOldEvents()
  } catch {
    // best-effort
  }
}

/** Hash a normalized ID number for storage (call before recordVerify). */
export function hashIdNumber(normalizedId: string): string | null {
  return hash(normalizedId)
}

// Opportunistic retention prune — at most once per 24h per process.
let lastPruneAt = 0
export async function pruneOldEvents(): Promise<void> {
  const now = Date.now()
  if (now - lastPruneAt < 24 * 60 * 60 * 1000) return
  lastPruneAt = now
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await AppDataSource.getRepository(OrgEvent)
    .createQueryBuilder()
    .delete()
    .where('createdAt < :cutoff', { cutoff })
    .execute()
}

// --- Reader (powers GET /api/orgs/<slug>/stats) ---

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

export async function readStats(orgId: number, rangeQuery: unknown): Promise<StatsResult> {
  const range = rangeDays(rangeQuery)
  const now = Date.now()
  const sinceMs = range > 0 ? now - range * 24 * 60 * 60 * 1000 : 0
  const since = sinceMs ? new Date(sinceMs).toISOString() : null
  const startDay = sinceMs ? new Date(sinceMs).toISOString().slice(0, 10) : '1970-01-01'
  const days = range > 0 ? dayRange(startDay) : []

  const eventRepo = AppDataSource.getRepository(OrgEvent)
  const statRepo = AppDataSource.getRepository(OrgDailyStat)

  // --- rollup rows in range (range>0: per-day series; all-time: per-metric totals) ---
  const rollups =
    range > 0
      ? await statRepo
          .createQueryBuilder('s')
          .select(['s.day AS day', 's.metric AS metric', 's.count AS count'])
          .where('s.orgId = :orgId', { orgId })
          .andWhere('s.day >= :startDay', { startDay })
          .getRawMany<{ day: string; metric: string; count: number }>()
      : await statRepo
          .createQueryBuilder('s')
          .select(['s.metric AS metric', 'SUM(s.count) AS count'])
          .where('s.orgId = :orgId', { orgId })
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
    .where('e.orgId = :orgId', { orgId })
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
              .where('e.orgId = :orgId', { orgId })
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
      .where('e.orgId = :orgId', { orgId })
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
