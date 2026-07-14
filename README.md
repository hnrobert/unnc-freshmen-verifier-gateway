# UNNC Freshmen Verifier Gateway

A **multi-tenant** verify-gateway built with **Nuxt 4 + SQLite**. Users register,
create **organizations** (each at `/<slug>`), and fully customize their own
bilingual (中文 / English) verify page — i18n labels, icons, welcome image and
Markdown body, theme, and gateway settings — through a web editor with **live
preview**. Verification queries the **live UNNC admission portal** server-side
(a faithful TypeScript port of `ref/client.py`, slider-captcha solver included).

---

## Tech stack

Nuxt 4 (SSR + Nitro) · SQLite (better-sqlite3) · Drizzle ORM · argon2id sessions
(`@noble/hashes`) · vue-i18n · Tailwind CSS v4 + shadcn-vue · lucide-vue-next ·
markdown-it · pngjs · pnpm

---

## Quick start

```bash
pnpm install          # installs deps + runs `nuxt prepare`
pnpm db:generate      # generate Drizzle migrations (already committed)
pnpm db:migrate       # apply them to ./data/app.db
pnpm db:seed          # seed a demo user + org
pnpm dev              # http://localhost:3000
```

**Demo account** (from seed): `demo@example.com` / `demo1234` · org slug `demo`
(view at `http://localhost:3000/demo`).

---

## How it works

- **Auth**: email/password registration, argon2id-hashed, revocable server-side
  sessions in an httpOnly cookie.
- **Organizations**: each user creates orgs with a unique `slug`; the public
  gateway lives at `/<slug>` (verify) and `/<slug>/welcome`.
- **Per-org config** (`org_settings.config`, a JSON `SiteConfig`): every label,
  icon, welcome markdown, theme radius, and gateway setting is per-org and
  editable in the dashboard. Images are stored as **base64** in `org_images` and
  referenced by `img:<key>` (resolved to `/api/orgs/<slug>/img/<key>` at render).
- **Live preview**: the editor renders the real verify/welcome components with
  the in-progress draft config (labels/i18n re-merge live as you type).
- **Verification**: `POST /api/orgs/<slug>/check` runs the ported
  `AdmissionClient` server-side (warmup → slider captcha → submit → parse) — no
  CORS, since Nitro calls the portal directly. Set `gateway.mode: 'mock'` to
  preview without the portal.

---

## Customizing (as an org owner)

1. Log in → **Dashboard** → **New organization** (pick a slug).
2. **Edit** → the split-pane editor:
   - **Locales** (zh/en + default), **Brand**, **Verify**, **Errors**,
     **Admission**, **Welcome** (Markdown body + image upload), **Footer**.
   - **Icons**: lucide allowlist picker (browse/search) or upload a custom image.
   - **Gateway**: `mode` (live/mock), `baseUrl`, captcha rounds/tries/timeout.
   - **Theme**: radius.
   - Right pane: **Live preview** (toggle Verify / Welcome).
3. **Save** (validates all required i18n keys first). **View ↗** opens the public
   `/<slug>` page.

---

## Project structure

```
app/                         Nuxt 4 srcDir
  pages/
    [slug]/{index,welcome}.vue      PUBLIC per-org gateway
    dashboard/{index,new}.vue  [slug]/edit.vue   admin
    login.vue register.vue
  components/
    public/   VerifyForm, WelcomeContent, BrandMark, LanguageToggle, ThemeToggle, Icon, StatusAlert, MarkdownView
    admin/    ConfigEditor, LivePreview, IconPicker, ImageUploader, MarkdownEditor
    ui/       shadcn-vue (button/input/label/card)
  composables/ useOrgConfig, useOrgI18n, useVerifier, useAuth
  lib/         verify, icon, iconAllowlist, markdown, utils
  plugins/     i18n, auth
  middleware/  auth, guest, welcome-gate
shared/                     app↔server code
  types.ts  lib/admissionCore.ts  lib/validateConfig.ts  lib/defaultConfig.ts
server/                     Nitro
  api/auth/{register,login,logout,me}
  api/orgs/  (CRUD, config get/put, validate, check, images, img/[key])
  utils/     db, auth, orgs, config, admission, png
  db/        schema.ts, seed.ts, migrations/
  middleware/session.ts  plugins/01.db.ts
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Nuxt dev server (auto-migrates the DB on boot) |
| `pnpm build` | Production build → `.output/` |
| `pnpm preview` | Preview the build (`node .output/server/index.mjs`) |
| `pnpm typecheck` | `nuxt typecheck` |
| `pnpm test` | Unit tests for the captcha solver + parser |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Drizzle migrations + seed |

---

## Production deployment

Nuxt SSR needs a persistent Node host (SQLite is a file). Set env vars:

- `SESSION_SECRET` — cookie/session signing secret (change from the dev default).
- `DB_PATH` — SQLite file path (on a persistent volume).
- `SESSION_SECRET` for prod cookies (`Secure` is set when `!dev`).

Build and run: `pnpm build && node .output/server/index.mjs` (set `PORT` if needed).
The DB auto-migrates on boot. Seed an admin/org with `pnpm db:seed` if desired.

---

## Notes & caveats

- **Captcha solver is best-effort**: the slider offset ranking (NCC/std/border)
  is a heuristic port of the Python original; it retries up to
  `gateway.maxCaptchaRounds`. Portal UI/anti-bot changes can break it silently.
  Use `mode: 'mock'` for reliable UI testing; live runs are manual smoke tests.
- **Welcome gate is UX-only**: the welcome content is in the SSR bundle; the
  `/<slug>/welcome` route is gated client-side by a `sessionStorage` flag, not a
  security boundary.
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
