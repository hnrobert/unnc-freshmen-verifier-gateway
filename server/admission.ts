/**
 * Server-side admission client. Runs the shared core against the portal DIRECTLY
 * (no CORS server-side, no browser proxy) with a manual cookie jar so the PHP
 * session persists across the captcha flow. This is what the original
 * `ref/client.py` did with `requests.Session()`.
 */
import type { GatewayConfig } from '../src/shared/types'
import {
  AdmissionQueryError,
  parseJsonBody,
  queryAdmission as coreQueryAdmission,
  type HttpHandlers,
} from '../src/lib/admissionCore'
import { decodeImage } from './png'

const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

/** Minimal cookie jar capturing Set-Cookie and replaying Cookie within one query. */
class CookieJar {
  private cookies = new Map<string, string>()

  capture(res: Response): void {
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const sc of setCookie) {
      const m = /^([^=;]+)=([^;]*)/.exec(sc)
      if (m) this.cookies.set(m[1]!.trim(), decodeURIComponent(m[2] ?? ''))
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

function buildUrl(gateway: GatewayConfig, path: string): string {
  // Server-side hits the portal directly. A `/`-prefix proxy is browser-only; a
  // `{url}` remote-proxy template is honored if set.
  const tpl = gateway.proxy
  const url = gateway.baseUrl.replace(/\/$/, '') + path
  if (!tpl || tpl.startsWith('/')) return url
  if (tpl.includes('{urlEncoded}')) return tpl.split('{urlEncoded}').join(encodeURIComponent(url))
  if (tpl.includes('{url}')) return tpl.split('{url}').join(url)
  return tpl.replace(/\/$/, '') + '/' + url.replace(/^https?:\/\//, '')
}

export function queryAdmission(gateway: GatewayConfig, name: string, id: string) {
  const jar = new CookieJar()

  async function raw(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), gateway.requestTimeoutMs)
    const headers = new Headers(init.headers)
    headers.set('User-Agent', BROWSER_UA)
    if (!headers.has('Accept')) headers.set('Accept', '*/*')
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', ACCEPT_LANGUAGE)
    const cookie = jar.header()
    if (cookie) headers.set('cookie', cookie)
    try {
      const res = await fetch(buildUrl(gateway, path), {
        ...init,
        headers,
        signal: controller.signal,
      })
      jar.capture(res)
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  const http: HttpHandlers = {
    async fetchText(path) {
      const r = await raw(path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return await r.text()
    },
    async fetchJson(path) {
      const r = await raw(path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return parseJsonBody(await r.text(), path)
    },
    async fetchBytes(path) {
      const r = await raw(path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return await r.arrayBuffer()
    },
    async postForm(path, fields) {
      const r = await raw(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      })
      if (!r.ok) throw new AdmissionQueryError(`post ${path} failed: ${r.status}`)
      return await r.text()
    },
  }

  return coreQueryAdmission(gateway, name, id, http, decodeImage)
}
