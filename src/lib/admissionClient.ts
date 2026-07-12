/**
 * Browser-side port of `ref/client.py` (`AdmissionClient`).
 *
 * Queries the live UNNC admission portal through a configurable CORS proxy
 * (browsers cannot call the portal directly — it sends no CORS headers). Solves
 * the server-side slider captcha by ranking candidate offsets with the same
 * image-analysis heuristics as the Python version (std / border / normalized
 * cross-correlation), then submits and parses the result HTML.
 *
 * The captcha flow is bound to a PHP session cookie, so the proxy MUST relay
 * cookies (use `gateway.credentials: 'include'` + a sticky proxy such as
 * proxy/cloudflare-worker.js).
 */
import type { AdmissionResult, GatewayConfig } from '@/shared/types'
import { decodeImage, type DecodedImage } from './png'

const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8'
const ID_PATTERN = /^\d{17}[\dX]$/

export class AdmissionQueryError extends Error {}

/* ------------------------------------------------------------- normalize -- */

function normalizeName(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeId(id: string): string {
  return (id ?? '').trim().toUpperCase()
}

/* ----------------------------------------------------------------- fetch -- */

/** Build the proxied URL for a portal path from the configured proxy setting.
 *  - A leading `/` → local same-origin prefix (handled by the Vite dev/preview
 *    proxy in vite.config.ts). No CORS, cookies just work.
 *  - A `{url}` / `{urlEncoded}` template → remote CORS proxy.
 *  - Otherwise → treated as a URL prefix.
 */
function proxied(gateway: GatewayConfig, path: string): string {
  const tpl = gateway.proxy
  if (tpl.startsWith('/')) return tpl.replace(/\/$/, '') + path
  const url = gateway.baseUrl.replace(/\/$/, '') + path
  if (tpl.includes('{urlEncoded}')) return tpl.split('{urlEncoded}').join(encodeURIComponent(url))
  if (tpl.includes('{url}')) return tpl.split('{url}').join(url)
  return tpl.replace(/\/$/, '') + '/' + url.replace(/^https?:\/\//, '')
}

async function gatewayFetch(
  gateway: GatewayConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), gateway.requestTimeoutMs)
  try {
    const headers = new Headers(init.headers)
    if (!headers.has('Accept')) headers.set('Accept', '*/*')
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', ACCEPT_LANGUAGE)
    const response = await fetch(proxied(gateway, path), {
      ...init,
      headers,
      credentials: gateway.credentials,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(gateway: GatewayConfig, path: string): Promise<Record<string, unknown>> {
  const r = await gatewayFetch(gateway, path)
  if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
  return (await r.json()) as Record<string, unknown>
}

async function getBytes(gateway: GatewayConfig, path: string): Promise<ArrayBuffer> {
  const r = await gatewayFetch(gateway, path)
  if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
  return await r.arrayBuffer()
}

async function postForm(
  gateway: GatewayConfig,
  path: string,
  fields: Record<string, string>,
): Promise<string> {
  const body = new URLSearchParams(fields).toString()
  const r = await gatewayFetch(gateway, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) throw new AdmissionQueryError(`post ${path} failed: ${r.status}`)
  return await r.text()
}

/* ----------------------------------------------------------- captcha flow -- */

async function warmup(gateway: GatewayConfig): Promise<void> {
  const r = await gatewayFetch(gateway, '/')
  if (!r.ok) throw new AdmissionQueryError(`warmup failed: ${r.status}`)
}

interface CaptchaInit {
  key: string
  token: string
  targetY: number
}

async function initCaptcha(gateway: GatewayConfig): Promise<CaptchaInit> {
  const data = await getJson(gateway, '/ajax/captcha_slider.php?action=init')
  if (data.status !== 'success') {
    throw new AdmissionQueryError(String(data.message ?? 'captcha init failed'))
  }
  if (!data.key || !data.token) throw new AdmissionQueryError('captcha missing key/token')
  return {
    key: String(data.key),
    token: String(data.token),
    targetY: Number(data.target_y ?? 0),
  }
}

async function verifyCaptcha(
  gateway: GatewayConfig,
  key: string,
  token: string,
  offset: number,
): Promise<{ status: string; message: string }> {
  const text = await postForm(gateway, '/ajax/captcha_slider.php', {
    action: 'verify',
    captcha_key: key,
    captcha_token: token,
    offset: String(offset),
  })
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    data = {}
  }
  return { status: String(data.status ?? 'error'), message: String(data.message ?? '') }
}

async function submitResult(
  gateway: GatewayConfig,
  args: { name: string; id: string; key: string; token: string; offset: number },
): Promise<string> {
  return postForm(gateway, '/result.php', {
    username: args.name,
    userid: args.id,
    captcha_key: args.key,
    captcha_token: args.token,
    captcha_offset: String(args.offset),
  })
}

/* ----------------------------------------------------- offset ranking -- */

/** Safe numeric read (noUncheckedIndexedAccess-friendly). */
const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0

function mean(a: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] ?? 0
  return a.length ? s / a.length : 0
}

function norm(a: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (a[i] ?? 0)
  return Math.sqrt(s)
}

/**
 * Rank candidate slider offsets, mirroring `_rank_offsets` in client.py:
 *  - std:  std-dev of the window's grayscale (background texture)
 *  - border: horizontal gradient strength at the window's left/right edges
 *  - ncc:  normalized cross-correlation of the window vs the piece (RGB)
 * Buckets take the top-10 of each heuristic (asc/desc) and merge in order.
 */
export function rankOffsets(bgImg: DecodedImage, pieceImg: DecodedImage, targetY: number): number[] {
  const bw = bgImg.width
  const bh = bgImg.height
  const bg = bgImg.data
  const pw = pieceImg.width
  const ph = pieceImg.height
  const y = Math.max(0, Math.min(Math.floor(targetY || 0), Math.max(0, bh - ph)))

  // Background grayscale + horizontal gradient (abs diff, first column prepended → 0).
  const gray = new Float32Array(bw * bh)
  for (let i = 0; i < bw * bh; i++) {
    const r = at(bg, i * 4)
    const g = at(bg, i * 4 + 1)
    const b = at(bg, i * 4 + 2)
    gray[i] = (r + g + b) / 3
  }
  const gx = new Float32Array(bw * bh)
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const idx = yy * bw + xx
      const left = xx === 0 ? gray[idx] ?? 0 : gray[idx - 1] ?? 0
      gx[idx] = Math.abs((gray[idx] ?? 0) - left)
    }
  }

  // Piece: RGB flattened, mean-subtracted (precomputed; constant across offsets).
  const pLen = ph * pw * 3
  const pFlat = new Float32Array(pLen)
  for (let i = 0; i < ph * pw; i++) {
    pFlat[i * 3] = at(pieceImg.data, i * 4)
    pFlat[i * 3 + 1] = at(pieceImg.data, i * 4 + 1)
    pFlat[i * 3 + 2] = at(pieceImg.data, i * 4 + 2)
  }
  const pMean = mean(pFlat)
  const p0 = new Float32Array(pLen)
  for (let i = 0; i < pLen; i++) p0[i] = (pFlat[i] ?? 0) - pMean
  const pNorm = norm(p0)

  interface Score {
    x: number
    std: number
    border: number
    ncc: number
  }
  const scored: Score[] = []
  const npix = ph * pw
  const winRGB = new Float32Array(npix * 3)

  for (let x = 0; x <= bw - pw; x++) {
    // Window RGB (also drives grayscale std).
    let sum = 0
    let sum2 = 0
    let k = 0
    for (let dy = 0; dy < ph; dy++) {
      for (let dx = 0; dx < pw; dx++) {
        const pi = (y + dy) * bw + (x + dx)
        const r = at(bg, pi * 4)
        const g = at(bg, pi * 4 + 1)
        const b = at(bg, pi * 4 + 2)
        winRGB[k++] = r
        winRGB[k++] = g
        winRGB[k++] = b
        const gv = (r + g + b) / 3
        sum += gv
        sum2 += gv * gv
      }
    }
    const meanG = sum / npix
    const std = Math.sqrt(Math.max(0, sum2 / npix - meanG * meanG))

    // Border: mean gradient over the window's left-2 and right-2 columns.
    let bSum = 0
    let bN = 0
    for (let dy = 0; dy < ph; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        bSum += gx[(y + dy) * bw + (x + dx)] ?? 0
        bN++
      }
      for (let dx = pw - 2; dx < pw; dx++) {
        bSum += gx[(y + dy) * bw + (x + dx)] ?? 0
        bN++
      }
    }
    const border = bN ? bSum / bN : 0

    // NCC over RGB: window mean-subtracted · piece mean-subtracted.
    const wMean = mean(winRGB)
    let dot = 0
    let wNormSq = 0
    for (let i = 0; i < pLen; i++) {
      const w0 = (winRGB[i] ?? 0) - wMean
      dot += w0 * (p0[i] ?? 0)
      wNormSq += w0 * w0
    }
    const ncc = dot / (Math.sqrt(wNormSq) * pNorm + 1e-6)

    scored.push({ x, std, border, ncc })
  }

  const byStd = [...scored].sort((a, b) => a.std - b.std)
  const byBorder = [...scored].sort((a, b) => b.border - a.border)
  const byNccLow = [...scored].sort((a, b) => a.ncc - b.ncc)
  const byNccHigh = [...scored].sort((a, b) => b.ncc - a.ncc)

  const ordered: number[] = []
  for (const bucket of [byStd, byBorder, byNccLow, byNccHigh]) {
    for (const item of bucket.slice(0, 10)) {
      if (!ordered.includes(item.x)) ordered.push(item.x)
    }
  }
  return ordered
}

/* --------------------------------------------------------- html parsing -- */

function cleanHtmlText(fragment: string | undefined): string | undefined {
  if (!fragment) return undefined
  let t = fragment.replace(/<[^>]+>/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return t || undefined
}

function matchGroup(pattern: string, text: string): string | undefined {
  const m = new RegExp(pattern, 'is').exec(text)
  return m?.[1]
}

export function parseResultHtml(html: string): AdmissionResult {
  if (html.includes('请先完成验证码验证') || (html.includes('error=') && html.includes('验证码'))) {
    return { ok: false, admitted: null, message: 'captcha rejected' }
  }

  const noResult = /class="no-result-box"\s*>\s*([^<]+)/is.exec(html)
  if (noResult || html.includes('未找到录取信息')) {
    const raw = noResult?.[1]
    const message = cleanHtmlText(raw) ?? '未找到录取信息！'
    return { ok: true, admitted: false, message }
  }

  const name = cleanHtmlText(matchGroup('class="overlay-name"[^>]*>(.*?)</div>', html))
  const detail = cleanHtmlText(matchGroup('class="overlay-message"[^>]*>(.*?)</div>', html))
  const university = cleanHtmlText(matchGroup('class="overlay-university"[^>]*>(.*?)</div>', html))
  const date = cleanHtmlText(matchGroup('class="overlay-date"[^>]*>(.*?)</div>', html))

  if (name || detail || (html.includes('class="stage"') && !html.includes('未找到录取信息'))) {
    return {
      ok: true,
      admitted: true,
      message: detail ?? '查询到录取信息',
      name,
      detail,
      university,
      date,
    }
  }

  return {
    ok: false,
    admitted: null,
    message: 'unrecognized result page',
  }
}

/* ----------------------------------------------------------------- query -- */

/**
 * Query admission status for a name + ID. Faithful port of
 * `AdmissionClient.query`. Retries captcha rounds up to `maxCaptchaRounds`.
 */
export async function queryAdmission(
  gateway: GatewayConfig,
  rawName: string,
  rawId: string,
): Promise<AdmissionResult> {
  const username = normalizeName(rawName)
  const userid = normalizeId(rawId)
  if (!username) return { ok: false, admitted: null, message: '请输入考生姓名' }
  if (!ID_PATTERN.test(userid)) {
    return { ok: false, admitted: null, message: '身份证号格式不正确' }
  }

  let lastError = '验证码求解失败，请稍后重试'

  for (let attempt = 1; attempt <= gateway.maxCaptchaRounds; attempt++) {
    try {
      await warmup(gateway)
      const { key, token, targetY } = await initCaptcha(gateway)
      const bgBytes = await getBytes(
        gateway,
        `/ajax/captcha_slider.php?action=bg&key=${encodeURIComponent(key)}`,
      )
      const pieceBytes = await getBytes(
        gateway,
        `/ajax/captcha_slider.php?action=piece&key=${encodeURIComponent(key)}`,
      )
      const bgImg = await decodeImage(bgBytes)
      const pieceImg = await decodeImage(pieceBytes)
      const offsets = rankOffsets(bgImg, pieceImg, targetY)

      let solvedOffset: number | null = null
      for (const offset of offsets.slice(0, gateway.maxOffsetTries)) {
        const { status, message } = await verifyCaptcha(gateway, key, token, offset)
        if (status === 'success') {
          solvedOffset = offset
          break
        }
        if (['过期', '使用', '无效'].some((s) => message.includes(s))) {
          lastError = message || lastError
          break
        }
      }

      if (solvedOffset === null) {
        lastError = '未能通过滑块验证码'
        continue
      }

      const html = await submitResult(gateway, {
        name: username,
        id: userid,
        key,
        token,
        offset: solvedOffset,
      })
      return parseResultHtml(html)
    } catch (error) {
      if (error instanceof AdmissionQueryError) {
        lastError = error.message
      } else if (error instanceof Error && error.name === 'AbortError') {
        lastError = '请求超时，请稍后重试'
      } else if (error instanceof Error && error.name === 'TypeError') {
        // fetch() throws TypeError on network/CORS failure.
        lastError = '网络请求失败'
      } else {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  return { ok: false, admitted: null, message: lastError }
}
