/**
 * Minimal Node backend for the UNNC admission verifier — the static-site
 * equivalent of `ref/app.py`. Exposes:
 *
 *   GET  /api/health   -> { ok: true, service }
 *   POST /api/check    -> AdmissionResult   (body: { username|name, userid|id_number })
 *
 * The SPA uses this when `gateway.transport === 'backend'` (default). Run it with
 * `pnpm server` (or `pnpm dev:all` to start it alongside Vite). In dev, Vite
 * proxies `/api` here (see vite.config.ts), so the SPA calls same-origin
 * `/api/check`.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import config from '../config/site.config'
import type { AdmissionResult } from '../src/shared/types'
import { queryAdmission } from './admission'

const PORT = Number(process.env.PORT ?? 8787)
// Allowed CORS origin for the SPA. `*` is fine for local dev; set CORS_ORIGIN for
// cross-origin production frontends.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'

function applyCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (CORS_ORIGIN !== '*') res.setHeader('Vary', 'Origin')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  applyCors(res)
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, '')
    return
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, service: 'unnc-admission-verifier' })
    return
  }

  if (url.pathname === '/api/check' && req.method === 'POST') {
    const body = await readJson(req)
    const username = String(body.username ?? body.name ?? '').trim()
    const userid = String(body.userid ?? body.id_number ?? body.idNumber ?? '').trim()

    if (!username || !userid) {
      const result: AdmissionResult = {
        ok: false,
        admitted: null,
        message: 'missing username/userid',
      }
      sendJson(res, 400, result)
      return
    }

    let result: AdmissionResult
    try {
      result =
        config.gateway.mode === 'mock'
          ? { ok: true, admitted: true, message: 'mock', name: username }
          : await queryAdmission(config.gateway, username, userid)
    } catch (error) {
      result = {
        ok: false,
        admitted: null,
        message: error instanceof Error ? error.message : String(error),
      }
    }

    // Completed query (incl. not-found / captcha failure) → 200 with the result;
    // the SPA decides what to show from the body.
    sendJson(res, 200, result)
    return
  }

  sendJson(res, 404, { ok: false, message: 'not found' })
})

server.listen(PORT, () => {
  console.log(
    `unnc-vg backend listening on http://localhost:${PORT}  (mode=${config.gateway.mode})`,
  )
})
