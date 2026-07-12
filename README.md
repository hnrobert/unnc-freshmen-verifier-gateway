# UNNC Freshmen Verifier Gateway

A **bilingual (中文 / English), fully-customizable** verify-gateway for UNNC
freshmen. Visitors enter a **name + ID number**; the app queries the **live UNNC
admission portal** (a faithful TypeScript port of `ref/client.py`, slider-captcha
solver included) and, on a match, shows a welcome page with your custom image,
title and **Markdown** body (bare URLs and emails auto-linked).

The portal can't be called from a browser directly (no CORS), so two transports
are supported and both work:

- **`backend` (default)** — the SPA calls a small **Node backend** (`/api/check`)
  that queries the portal server-side (no CORS, a manual cookie jar for the
  session). This is the reliable path and the static-site equivalent of
  `ref/app.py`.
- **`browser`** — the SPA calls the portal itself through the Vite dev/preview
  proxy (`/__portal`) or a host rewrite / remote CORS proxy.

The captcha-solving + parsing logic lives in one shared core used by both.

---

## Tech stack

TypeScript · Node 24 · Vue 3 · Vite · vue-router · vue-i18n · Tailwind CSS v4 +
[shadcn-vue](https://shadcn-vue.com) · lucide-vue-next · markdown-it · pngjs ·
tsup (CLI) · pnpm

---

## Quick start

```bash
pnpm install      # also runs `gen` (postinstall) to build the icon registry
pnpm dev:all      # backend + Vite dev server, together (default transport)
```

`dev:all` runs the backend (`localhost:8787`) and Vite (`localhost:5173`)
concurrently; Vite proxies `/api` → the backend, so the SPA's default `backend`
transport just works. Open the printed Vite URL, enter a name + 18-digit ID.

Other entry points:

```bash
pnpm dev          # Vite only (use with transport 'browser', or run pnpm server separately)
pnpm server       # the Node backend alone on :8787
pnpm build        # static production build -> dist/
pnpm preview      # serve dist/ locally (proxies /api and /__portal)
pnpm test         # unit tests: captcha-ranking math + result parser
```

> **Previewing the welcome UI without the portal?** Set `gateway.mode: 'mock'` in
> `config/site.config.ts` — any well-formed name + 18-digit ID is admitted (works
> in both transports and the backend).

---

## How verification works

`ref/client.py`'s `AdmissionClient` is ported to `src/lib/admissionCore.ts`
(transport-agnostic): warmup → init captcha → fetch bg/piece → **rank slider
offsets** (grayscale std-dev, edge gradient, RGB normalized cross-correlation) →
verify offsets → submit → **parse** the result HTML. The HTTP layer and PNG
decoder are injected:

- **Browser** (`src/lib/admissionClient.ts` + `src/lib/png.ts`) — `fetch` through
  the configured proxy, canvas PNG decode, browser-managed session cookie.
- **Backend** (`server/admission.ts` + `server/png.ts`) — direct `fetch` to the
  portal (no CORS server-side), a manual cookie jar, pngjs decode, a browser
  User-Agent.

| Portal outcome | Gateway behaviour |
| --- | --- |
| Admitted | Unlock the welcome page (with the portal's name/university/date) |
| Not found | Localized "no admission record" error |
| Captcha / network failure | Localized error, retryable |

The backend's `POST /api/check` mirrors `ref/app.py` — body `{ username|name,
userid|id_number }`, response `AdmissionResult` JSON.

---

## Customizing everything

All customization lives in **`config/site.config.ts`** (type-checked, full
autocomplete). After editing icons, run `pnpm gen`; after editing anything,
`pnpm build`.

### Gateway & transport

```ts
gateway: {
  mode: 'live',            // 'live' = real portal, 'mock' = UI preview
  transport: 'backend',    // 'backend' (SPA -> /api/check) or 'browser' (SPA -> proxy)
  api: '/api/check',       // backend endpoint (transport 'backend'); relative or absolute
  baseUrl: 'https://entry.nottingham.edu.cn',
  proxy: '/__portal',      // transport 'browser' only (see below)
  maxCaptchaRounds: 6,
  maxOffsetTries: 25,
  requestTimeoutMs: 20000,
  credentials: 'include',
}
```

`gateway.proxy` (browser transport only):
- **`/prefix`** — same-origin prefix, handled by the Vite dev/preview proxy or a
  host rewrite.
- **`https://your-proxy/{url}`** / **`{urlEncoded}`** — a remote CORS proxy.

### Labels & content (bilingual)

Every label, error, and the welcome title/body live under `messages.zh` /
`messages.en` — fed straight into vue-i18n; the keys are exactly what templates
render via `t('...')`.

### Icons · welcome assets · theme

```ts
icons: { brand: 'GraduationCap' /* or { img: '/crest.png' } */ }
welcome: { image: './welcome.svg', imageMaxWidth: '12rem', imageRounded: true }
theme: { radius: '0.65rem' }   // colors are CSS vars in src/style.css
```

Only referenced icons are bundled (`pnpm gen`). The welcome body is Markdown;
bare URLs/emails are auto-linked (TLD-agnostic) and open in a new tab.

---

## Production deployment

- **Backend transport (default, recommended):** deploy the static `dist/` **and**
  the Node backend (`server/`). Point `gateway.api` at the backend (same origin,
  or an absolute URL with CORS). No CORS/proxy headaches — the backend reaches
  the portal server-side. Run the backend with `tsx server/index.ts` (or bundle
  it), set `PORT` / `CORS_ORIGIN` via env.
- **Browser transport + host rewrite (no server code):** keep `gateway.proxy:
  '/__portal'` and proxy at the CDN — `public/_redirects` (Netlify / Cloudflare
  Pages) and `vercel.json` (Vercel) are included. GitHub Pages can't proxy, so it
  needs the backend or an external proxy there.

---

## CLI (`unnc-vg`)

```bash
pnpm cli gen        # regenerate src/generated/icons.ts from config icons
pnpm cli validate   # check gateway config + required i18n keys
pnpm cli help
```

---

## Project structure

```
config/site.config.ts        # ← edit: labels, icons, welcome content, gateway/transport
src/
  lib/admissionCore.ts       # shared port of ref/client.py (captcha + parse)
  lib/admissionClient.ts     # browser wrapper (proxy + canvas decode)
  lib/png.ts                 # browser PNG decode
  lib/verify.ts              # routes to mock / backend / browser
  lib/markdown.ts, icon.ts   # markdown autolink, icon resolver
  i18n/, components/ui/, pages/, layouts/
  cli/index.ts               # tsup-bundled CLI: gen + validate
  generated/icons.ts         # gitignored; created by `pnpm gen`
server/
  index.ts                   # Node backend: POST /api/check, GET /api/health
  admission.ts               # server wrapper (direct fetch + cookie jar)
  png.ts                     # pngjs decode
scripts/selftest.ts          # unit tests for captcha math + parser
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev:all` | backend + Vite dev server together (default) |
| `pnpm server` | Node backend on :8787 |
| `pnpm dev` | Vite only (proxies `/api` and `/__portal`) |
| `pnpm build` | Static production build → `dist/` |
| `pnpm preview` | Serve `dist/` locally (proxies active) |
| `pnpm test` | Unit tests: captcha ranking + result parsing |
| `pnpm gen` / `pnpm validate` | Icon registry / config validation |
| `pnpm build:cli` | Bundle the CLI with tsup |
| `pnpm typecheck` | `vue-tsc --noEmit` |

---

## Notes & caveats

- **Portal reachability is environmental.** The `ENOTFOUND entry.nottingham.edu.cn`
  you may see means the portal host isn't resolvable from the running machine
  (DNS/network). The backend and browser transports both need to actually reach
  `gateway.baseUrl` — set it to a reachable URL or run from a network that can
  resolve it. Use `mode: 'mock'` to develop the UI without the portal.
- **CORS is unavoidable for browser-direct.** A static origin can't read the
  portal's responses without a server-side hop — that's the backend (default) or
  a proxy/rewrite (browser transport).
- **Browser language** is auto-detected on first visit; language/theme persist.
  Verification state lives in `sessionStorage` (per-tab, resets on close).
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
