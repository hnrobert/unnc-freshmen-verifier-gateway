/**
 * Browser-side wrapper around the shared admission core. Builds URLs through the
 * configured proxy (browsers cannot call the portal directly — no CORS), lets the
 * browser manage the session cookie via `credentials: 'include'`, and decodes the
 * captcha PNGs with a canvas. The captcha-solving + parsing logic lives in
 * `admissionCore.ts`, shared with the Node backend.
 */
import type { GatewayConfig } from '@/shared/types'
import {
  AdmissionQueryError,
  parseJsonBody,
  queryAdmission as coreQueryAdmission,
  type HttpHandlers,
} from './admissionCore'
import { decodeImage } from './png'

const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8'

/** Build the proxied URL for a portal path from the configured proxy setting.
 *  - A leading `/` → local same-origin prefix (handled by the Vite dev/preview
 *    proxy in vite.config.ts) or a host rewrite (_redirects / vercel.json).
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
    return await fetch(proxied(gateway, path), {
      ...init,
      headers,
      credentials: gateway.credentials,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function makeHttp(gateway: GatewayConfig): HttpHandlers {
  return {
    async fetchText(path) {
      const r = await gatewayFetch(gateway, path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return await r.text()
    },
    async fetchJson(path) {
      const r = await gatewayFetch(gateway, path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return parseJsonBody(await r.text(), path)
    },
    async fetchBytes(path) {
      const r = await gatewayFetch(gateway, path)
      if (!r.ok) throw new AdmissionQueryError(`request ${path} failed: ${r.status}`)
      return await r.arrayBuffer()
    },
    async postForm(path, fields) {
      const body = new URLSearchParams(fields).toString()
      const r = await gatewayFetch(gateway, path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!r.ok) throw new AdmissionQueryError(`post ${path} failed: ${r.status}`)
      return await r.text()
    },
  }
}

/** Query admission status (browser transport — via proxy, browser-managed cookies). */
export function queryAdmission(gateway: GatewayConfig, name: string, id: string) {
  return coreQueryAdmission(gateway, name, id, makeHttp(gateway), decodeImage)
}
