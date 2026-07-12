# UNNC Freshmen Verifier Gateway

A **static, fully-customizable, bilingual (中文 / English)** verify-gateway for UNNC
freshmen. Visitors enter a **name + ID number**; the app queries the **live UNNC
admission portal** (a faithful TypeScript port of the Python `ref/client.py`,
slider-captcha solver included) and, on a match, shows a welcome page with your
custom image, title and **Markdown** body (bare URLs and emails auto-linked).

The portal cannot be called from a browser directly (no CORS), so by default
requests are routed through the **Vite dev/preview proxy on your own machine**
(`/__portal` → `entry.nottingham.edu.cn`). Run it locally with `pnpm dev`.

---

## Tech stack

TypeScript · Node 24 · Vue 3 · Vite · vue-router · vue-i18n · Tailwind CSS v4 +
[shadcn-vue](https://shadcn-vue.com) · lucide-vue-next · markdown-it · tsup (CLI) · pnpm

---

## Quick start

```bash
pnpm install      # also runs `gen` (postinstall) to build the icon registry
pnpm dev          # dev server at http://localhost:5173 — live portal queries work locally
pnpm build        # production static build -> dist/
pnpm preview      # serve dist/ locally (portal proxy still active in preview)
pnpm test         # unit tests for the captcha-ranking math + result parser
```

`pnpm dev` and `pnpm preview` proxy `/__portal` → the admission portal (see
`vite.config.ts`), so verification runs against the real gateway on your machine
with **no remote proxy and no extra setup**.

> **Previewing the welcome UI without the portal?** Set `gateway.mode: 'mock'` in
> `config/site.config.ts` — any well-formed name + 18-digit ID is admitted. Set it
> back to `'live'` for real queries.

---

## How verification works

A 1:1 port of `ref/client.py`'s `AdmissionClient` runs **in the browser**:

1. **Warmup** → **init captcha** (get `key`/`token`/`target_y`).
2. Fetch the slider **background** + **piece** bitmaps.
3. **Rank candidate offsets** with the same heuristics as the Python version
   (window grayscale std-dev, edge gradient, and RGB normalized cross-correlation),
4. **Verify** offsets until the captcha passes.
5. **Submit** name + ID + captcha → **parse** the returned HTML (admitted /
   not-found / unrecognized).

All HTTP goes through `gateway.proxy`. With the default `'/__portal'` prefix and
the Vite proxy, the browser calls same-origin `/__portal/...` (no CORS) and Vite
forwards it server-side, relaying the PHP session cookie so the multi-step
captcha flow stays bound to one session.

| Portal outcome | Gateway behaviour |
| --- | --- |
| Admitted | Unlock the welcome page (with the portal's name/university/date) |
| Not found | Localized "no admission record" error |
| Captaptcha / network failure | Localized error, retryable |

---

## Customizing everything

All customization lives in **`config/site.config.ts`** (type-checked, full
autocomplete). After editing icons, run `pnpm gen`; after editing anything,
`pnpm build`.

### Gateway & proxy

```ts
gateway: {
  mode: 'live',                       // 'live' = real portal, 'mock' = UI preview
  baseUrl: 'https://entry.nottingham.edu.cn',
  proxy: '/__portal',                 // local prefix handled by the Vite proxy
  maxCaptchaRounds: 6,                // captcha re-init attempts
  maxOffsetTries: 25,                 // slider offsets tried per round
  requestTimeoutMs: 20000,
  credentials: 'include',             // relays the session cookie
}
```

`gateway.proxy` accepts:
- **`/prefix`** — local same-origin prefix, proxied by Vite dev/preview (default).
- **`https://your-proxy/{url}`** or **`{urlEncoded}`** — a remote CORS proxy, if you
  deploy the built site to a static host and need server-side relaying there.

### Labels & content (bilingual)

Every label, error message, and the welcome title/body live under
`messages.zh` / `messages.en` — fed straight into vue-i18n, so the keys
(e.g. `verify.nameLabel`, `welcome.body`) are exactly what templates render via
`t('...')`.

### Icons (every page)

Any `lucide-vue-next` name, or a custom image:

```ts
icons: { brand: 'GraduationCap', submit: 'ArrowRight' /* , brand: { img: '/crest.png' } */ }
```

Only referenced icons are bundled (`pnpm gen` builds a tiny registry).

### Welcome page assets

```ts
welcome: { image: './welcome.svg', imageMaxWidth: '12rem', imageRounded: true }
```

The body is **Markdown**; bare URLs/emails are auto-linked (TLD-agnostic:
`.dev`, `.app`, `.edu.cn`, …) and open in a new tab. The portal's admission
details (name/university/date) render in a card above the markdown.

### Theme & branding

`theme.radius` sets the global radius; colors are CSS variables in
`src/style.css` (`:root` / `.dark`). Dark/light toggle is built in.

### Adding a locale

1. Add the code to `locales` (e.g. `'ja'`) and a `messages.ja` block.
2. Update `Locale` in `src/shared/types.ts`.
3. `pnpm gen && pnpm build`.

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
config/site.config.ts     # ← edit: labels, icons, welcome content, gateway/proxy
src/
  cli/index.ts            # tsup-bundled CLI: gen + validate
  shared/types.ts         # config + admission types
  lib/
    admissionClient.ts    # port of ref/client.py (warmup → captcha → submit → parse)
    png.ts                # browser PNG/RGB decode via canvas (no image lib)
    verify.ts             # maps AdmissionResult → UI reasons (live + mock)
    markdown.ts           # markdown-it + TLD-agnostic autolinking
    icon.ts               # resolves config icon refs
  i18n/                   # vue-i18n from config.messages
  components/ui/          # shadcn-vue: button, input, label, card
  pages/                  # VerifyPage.vue, WelcomePage.vue
  generated/icons.ts      # gitignored; created by `pnpm gen`
scripts/selftest.ts       # unit tests for captcha math + parser
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server (portal proxy active) |
| `pnpm build` | Static production build → `dist/` |
| `pnpm preview` | Serve `dist/` locally (portal proxy active) |
| `pnpm test` | Unit tests: captcha ranking + result parsing |
| `pnpm gen` | Regenerate the icon registry |
| `pnpm validate` | Validate `config/site.config.ts` |
| `pnpm build:cli` | Bundle the CLI with tsup |
| `pnpm typecheck` | `vue-tsc --noEmit` |

---

## Notes & caveats

- **Local-only live mode.** The `/__portal` proxy exists in `vite dev` / `vite
  preview`, so real portal queries work on your machine. A built site deployed to
  a static host has no such proxy — point `gateway.proxy` at your own
  server-side proxy (the `{url}` template form) if you need live queries there.
- **Session cookies.** The captcha flow is bound to a PHP session cookie; the
  Vite proxy rewrites the cookie domain (`cookieDomainRewrite`) so it persists
  across the warmup → init → verify → submit requests.
- **Browser language** is auto-detected on first visit; language/theme persist.
- Verification state lives in `sessionStorage` (per-tab, resets on close).
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
