# UNNC Freshmen Verifier Gateway

A **multi-tenant** verify-gateway built with **Nuxt 4 + SQLite**. Users register,
create **organizations** (each at `/<slug>`), and fully customize their own
bilingual (中文 / English) verify page — i18n labels, icons, welcome image and
Markdown body, theme, background, and gateway settings — through a web editor
with **live preview**. Verification queries the **live UNNC admission portal**
server-side (a faithful TypeScript port of `ref/client.py`, slider-captcha
solver included).

---

## Tech stack

Nuxt 4 (SSR + Nitro) · SQLite (better-sqlite3) · **TypeORM** (entities +
migrations) · argon2id passwords (`@noble/hashes`) · revocable server-side
sessions + JWT trust cookies (`jsonwebtoken`) · vue-i18n · Tailwind CSS v4 +
shadcn-vue · lucide-vue-next · markdown-it · pngjs · Chart.js/vue-chartjs ·
ua-parser-js · vue-sonner · pnpm

> Node **>= 24** is required (the Docker image uses `node:24-slim`).

---

## Quick start

```bash
pnpm install          # installs deps + runs `nuxt prepare`
pnpm db:seed          # optional: seed a demo user + org
pnpm dev              # http://localhost:3000
```

In **dev** the schema is auto-synced from the TypeORM entities on boot
(`AppDataSource.synchronize()` in `server/utils/database.ts`), so you do **not**
need to run migrations locally. The seed is also optional.

**Demo account** (from seed): `demo@example.com` / `demo1234` · org slug `demo`
(view at `http://localhost:3000/demo`).

> The first user to register becomes `superadmin`; everyone after is `admin`.

---

## How it works

### Auth & accounts

- **Register / login**: email + password (min 8 chars), passwords hashed with
  **argon2id** (random 16-byte salt, constant-time compare).
- **Sessions**: on login a **revocable, server-side** session row is created and
  its id stored in the `vg_session` **httpOnly** cookie (30-day TTL, `Secure` on
  HTTPS). The `server/middleware/session.ts` middleware resolves the session on
  every request into `event.context.user` — **this is what authorizes requests.**
- **JWT trust cookies** (`jsonwebtoken`, 7-day window):
  - `vg_jwt` — issued to logged-in users on login/register and cleared on
    logout. (Issued for forward-compat; the revocable session remains the
    authoritative auth signal.)
  - `vg_verify` — issued to **anonymous visitors** after a successful portal
    admission. It is name+ID-based, so once a visitor is verified they are
    admitted on **any org** for 7 days without re-querying the portal
    (consumed in `POST /api/orgs/<slug>/check`).
- **Roles**: `superadmin` (the first account) or `admin`. Superadmins get an
  **admin panel** — browse/edit every org and change any user's role.
- **Account settings** (`/dashboard/settings`): change email and/or password
  (password change requires the current password), and manage **passkeys**.
- **Passkeys (WebAuthn)**: an optional passwordless login. Users add a passkey
  (Face ID / Touch ID / security key) in account settings; the login page shows a
  **"Sign in with passkey"** button. Login is **discoverable (usernameless)** —
  the chosen credential's id identifies the account, so no email is needed.
  Challenges are stored in a signed short-lived `vg_pk_challenge` cookie (always
  cleared after verify to prevent replay). The RP id/origin are derived per-request
  (localhost / HTTPS tunnels / prod), with optional `WEBAUTHN_RP_ID` /
  `WEBAUTHN_ORIGIN` overrides. **WebAuthn requires a secure context**, so passkeys
  only work over **HTTPS or `http://localhost`** (not plain-HTTP tunnels). Uses
  `@simplewebauthn/server` + `@simplewebauthn/browser` (v13); credentials live in
  the `passkeys` table (one user → many passkeys).

### Organizations

- Each user creates orgs with a unique `slug` (`/dashboard/new`); the public
  gateway lives at `/<slug>` (verify) and `/<slug>/welcome`.
- Slug rules: 3–32 chars, lowercase letters/digits/hyphens, no leading/trailing/
  consecutive hyphens; reserved slugs (`api`, `dashboard`, `admin`, `welcome`,
  …) are blocked (`server/utils/orgs.ts`).
- **Per-org config** (`org_settings.config`, a JSON `SiteConfig`): every label,
  icon, welcome Markdown, theme radius + primary color, background, and gateway
  setting is per-org and editable in the dashboard. Loaded config is cached
  in-memory (60s TTL; invalidated on save).
- **Images** are stored as **base64** in `org_images` and referenced by
  `img:<key>`. At render time refs are resolved to `data:` URLs
  (`resolveImageRefs`); they are also served at
  `GET /api/orgs/<slug>/img/<key>`.
- **Live preview**: the editor at `/dashboard/<slug>/edit` renders the real
  verify/welcome components with the in-progress draft config (labels/i18n
  re-merge live as you type). A standalone preview lives at `/<slug>/preview`
  (gated by auth + ownership — see `middleware/preview-guard.ts`).
- **Theming**: per-org border radius + primary color (drives `--radius`,
  `--primary`, `--ring` CSS vars), a per-org **favicon** rendered from the org's
  brand icon, an optional full-page **background image** with a darkening
  overlay, and **no-FOUC dark mode** (theme applied synchronously in `<head>`).

### Verification

`POST /api/orgs/<slug>/check` runs the ported `AdmissionClient` server-side
(warmup → slider captcha → submit → parse) — no CORS, since Nitro calls the
portal directly. Resolution order:

1. **Trust bypass** — if a valid `vg_verify` cookie matches the submitted
   name+ID, admit immediately.
2. **Mock mode** — `gateway.mode: 'mock'` admits any well-formed input (for UI
   preview) and still issues a verify cookie.
3. **Live mode** — query the portal; on a successful admission, issue a verify
   cookie for future cross-org trust.

### Org sharing

An org's owner can **share** it with other registered users so they can also
view/manage that org's data. Roles (low → high): **viewer** (read config +
stats) · **editor** (edit config/images) · **manager** (also manage members) ·
**owner** · **superadmin** (bypasses). Access is rank-checked by `requireOrgRole`
in `server/utils/members.ts`.

- **Invite by email link**: owner/manager enters an email → a pending
  `org_members` row + one-time token is created → recipient opens `/invite/<token>`
  and must **sign in with that exact email** to claim. Managers can invite
  viewers/editors; **only the owner** can invite managers or **transfer ownership**.
- `GET /api/orgs` returns **owned ∪ shared** orgs, each tagged with the caller's
  role; the dashboard badges shared orgs. Any member can self-leave.

### Statistics

Per-org analytics live in SQLite: page views + unique visitors, verification
outcomes (admitted / not-found / error) + modes (live / mock / trusted), and a
visitor profile (locale+region, device/browser/OS, referer). Two tables:

- **`org_events`** — raw event log, **retained 90 days** then pruned.
- **`org_daily_stats`** — permanent daily rollup (powers trend charts long-term).

**Privacy:** the visitor name is stored plaintext, but the **ID number and IP are
stored only as salted SHA-256 hashes** (`id_hash`, `ip_hash`) — never raw. Region
is inferred from the Accept-Language suffix (no GeoIP DB shipped). Views are
counted via a public `POST /api/orgs/<slug>/track` beacon; each verification is
recorded inside `check`. Charts render at `/dashboard/<slug>/stats` via
Chart.js/vue-chartjs.

---

## API surface

| Area    | Method · Path                            | Auth       | Notes                                         |
| ------- | ---------------------------------------- | ---------- | --------------------------------------------- |
| Auth    | `POST /api/auth/register`                | public     | first user → `superadmin`                     |
|         | `POST /api/auth/login`                   | public     |                                               |
|         | `POST /api/auth/logout`                  | —          | clears session + both JWT cookies             |
|         | `GET /api/auth/me`                       | session    | current user                                  |
|         | `PATCH /api/auth/me`                     | session    | change email and/or password                  |
|         | `GET /api/auth/passkey`                  | session    | list own passkeys                             |
|         | `GET /api/auth/passkey/register-options` | session    | add-passkey ceremony (options)                |
|         | `POST /api/auth/passkey/register-verify` | session    | verify + store credential                     |
|         | `GET /api/auth/passkey/login-options`    | public     | passkey-login ceremony (options)              |
|         | `POST /api/auth/passkey/login-verify`    | public     | verify → create session                       |
|         | `DELETE /api/auth/passkey/<id>`          | session    | remove own passkey                            |
| Orgs    | `GET /api/orgs`                          | session    | list accessible orgs (owned ∪ shared)         |
|         | `POST /api/orgs`                         | session    | create org                                    |
|         | `POST /api/orgs/validate`                | session    | slug validation                               |
|         | `GET /api/orgs/<slug>/config`            | —          | resolved public config (used by SSR)          |
|         | `GET /api/orgs/<slug>/config?edit`       | viewer+    | raw config for the editor                     |
|         | `PUT /api/orgs/<slug>/config`            | editor+    | save edited config                            |
|         | `POST /api/orgs/<slug>/images`           | editor+    | upload image → `img:<key>`                    |
|         | `DELETE /api/orgs/<slug>`                | owner/SA   | cascade-deletes settings/images/members/stats |
|         | `POST /api/orgs/<slug>/check`            | —          | run verification (records a stats event)      |
|         | `POST /api/orgs/<slug>/track`            | —          | public page-view beacon                       |
|         | `GET /api/orgs/<slug>/img/<key>`         | —          | serve stored image                            |
|         | `GET /api/orgs/<slug>/stats`             | viewer+    | totals + daily series + breakdowns            |
|         | `GET /api/orgs/<slug>/access`            | viewer+    | caller's role on this org                     |
| Sharing | `GET /api/orgs/<slug>/members`           | manager+   | list members + owner                          |
|         | `POST /api/orgs/<slug>/members`          | manager+   | invite by email → invite link                 |
|         | `PATCH /api/orgs/<slug>/members/<id>`    | manager+   | change role (owner-only → manager)            |
|         | `DELETE /api/orgs/<slug>/members/<id>`   | manager+   | remove (or self-leave)                        |
|         | `POST /api/orgs/<slug>/transfer`         | owner+     | transfer ownership                            |
|         | `GET /api/invites/<token>`               | —          | invite details (landing page)                 |
|         | `POST /api/invites/<token>/claim`        | session    | claim invite (email must match)               |
| Admin   | `GET /api/admin/users`                   | superadmin |                                               |
|         | `PATCH /api/admin/users/<id>`            | superadmin | set role                                      |
|         | `GET /api/admin/orgs`                    | superadmin | all orgs + owner emails                       |
| Misc    | `GET /api/icon.svg`                      | —          | lucide name → SVG in an org color             |

Roles: viewer < editor < manager < owner < superadmin, enforced by
`requireOrgRole` (`server/utils/members.ts`). "viewer+" / "editor+" / "manager+"
/ "owner+" = minimum rank; "owner/SA" = owner or superadmin.

---

## Customizing (as an org owner)

1. Log in → **Dashboard** → **New organization** (pick a slug).
2. **Edit** → the split-pane editor:
   - **Locales** (zh/en + default), **Brand**, **Verify**, **Errors**,
     **Admission**, **Welcome** (Markdown body + image upload), **Footer**.
   - **Icons**: lucide allowlist picker (browse/search) or upload a custom image.
   - **Gateway**: `mode` (live/mock), `baseUrl`, captcha rounds/tries/timeout.
   - **Theme**: radius + primary color. Optional background image + overlay.
   - Right pane: **Live preview** (toggle Verify / Welcome).
3. **Save** (validates all required i18n keys first). **View ↗** opens the public
   `/<slug>` page.

---

## Database & migrations

Schema is defined by TypeORM entities in `server/entities/`. Three mechanisms
keep it in sync:

- **Dev / boot**: `initDataSource()` runs `synchronize()` — additive only
  (creates missing tables/columns, never drops data).
- **Managed migrations** in `server/migrations/` (currently `Init`,
  `AddJwtTrust`, `AddUserRole`, `AddPasskeys`), applied via the TypeORM CLI
  wrappers below. _(Note: `synchronize()` is what actually provisions the schema
  at runtime; the DataSource does not currently register a `migrations` array, so
  `db:run` reports none pending. The migration files remain as convention and
  satisfy the pre-commit guard.)_
- **Pre-commit guard** (`pnpm db:check`): refuses a commit that changes
  `server/entities` without an accompanying new migration (bypass by including
  `bypass migration check` in the commit message).

| Script                              | What it does                             |
| ----------------------------------- | ---------------------------------------- |
| `pnpm db:run`                       | Run pending migrations (`migration:run`) |
| `pnpm db:revert`                    | Revert the last migration                |
| `pnpm db:generate -- --name=<Name>` | Generate a migration from entity changes |
| `pnpm db:check`                     | Pre-commit entity↔migration guard        |
| `pnpm db:seed`                      | Seed the demo user + org                 |

> There is **no `db:migrate`** script — use `db:run` to apply migrations.

---

## Scripts

| Script           | What it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `pnpm dev`       | Nuxt dev server (auto-syncs schema on boot)                       |
| `pnpm build`     | Production build → `.output/`                                     |
| `pnpm preview`   | Preview the build (`node .output/server/index.mjs`)               |
| `pnpm typecheck` | `nuxt typecheck`                                                  |
| `pnpm test`      | Self-test for the captcha solver + parser (`scripts/selftest.ts`) |

---

## Production deployment

Nuxt SSR needs a persistent Node host (SQLite is a file). Required env vars:

- `SESSION_SECRET` — cookie/JWT signing secret (**change** from the dev default).
- `DB_PATH` — SQLite file path (on a persistent volume).
- `PORT` — listen port (defaults to 3000).

### Option A — Docker (recommended)

`docker-compose up` builds the multi-stage image (`node:24-slim`), mounts a
named volume at `/app/data`, and starts `.output/server/index.mjs`. The schema
auto-syncs on boot. Set `SESSION_SECRET` in the environment (or `.env`).

```bash
SESSION_SECRET=... docker compose up --build -d
```

### Option B — Manual

```bash
pnpm build && node .output/server/index.mjs
```

The DB auto-migrates on boot. Seed an admin/org with `pnpm db:seed` if desired.
`Secure` is set on auth cookies only when the request is genuinely HTTPS
(`server/utils/request.ts`), so logins still work over an HTTP tunnel
(ngrok/frp/Cloudflare) forwarding `X-Forwarded-Proto: https`.

---

## Project structure

```bash
# App shell — Nuxt 4 flat layout (srcDir: '.'), SSR, Tailwind v4
app.vue                     # <NuxtLayout><NuxtPage/></NuxtLayout>
nuxt.config.ts              # SSR + Tailwind v4; per-org favicon, decorator opts

pages/
  index.vue                            # landing (redirects → /dashboard)
  login.vue  register.vue              # auth (auth layout, guest middleware)
  [slug]/
    index.vue  welcome.vue             # PUBLIC per-org gateway (default layout)
    preview/{index,welcome}.vue        # auth+ownership-gated live preview
  dashboard/
    index.vue  new.vue  settings.vue   # user dashboard + account settings
    [slug]/edit.vue                    # org config editor (sticky save bar)
    admin.vue                          # SUPERADMIN: orgs · users · registration whitelist

components/
  SaveBar.vue                 # shared sticky save/discard bar (edit/settings/whitelist)
  public/    # BrandMark, Icon, LanguageToggle, ThemeToggle, StatusAlert,
             # VerifyForm, WelcomeContent, MarkdownView
  admin/     # ConfigEditor, IconPicker, ImageUploader, ImagePreview,
             # LocaleField, MarkdownEditor
  ui/        # shadcn-vue: button, card, input, label

composables/                  # useAuth, useAuthForm, useOrgConfig, useOrgI18n, useVerifier
lib/                          # verify, icon, iconAllowlist, markdown, utils
utils/                        # errors (auto-imported)
plugins/                      # i18n (vue-i18n); auth (hydrates user via /api/auth/me)
middleware/                   # auth, guest, superadmin, preview-guard, welcome-gate
shared/                       # app↔server code, auto-aliased to #shared
  types.ts
  lib/                        # admissionCore, applyDefaults, defaultConfig, escapeMessage, validateConfig

server/                       # Nitro
  api/
    auth/                     # register · login · logout · me.{get,patch}
    auth/passkey/             # {register,login}-{options,verify} · index.get · [id].delete
    orgs/                     # index.{get,post} · validate · [slug]/{config.{get,put}, check, images, img/[key], index.delete}
    admin/                    # users · users/[id].patch · orgs · registration.{get,put}
    icon.svg.get              # lucide → SVG favicon (orgs with a vector brand icon)
  entities/                   # user · session · passkey · organization · orgSetting · orgImage · verification · appSetting
  utils/                      # database · auth · jwt · orgs · config · admission · webauthn · registration · request · png
  middleware/                 # session.ts (resolves session → event.context.user)
  plugins/                    # 01.db.ts (init DataSource + synchronize on boot)
  migrations/                 # Init · AddJwtTrust · AddUserRole · AddPasskeys · OrgSharingStats
  scripts/                    # runMigration · revertMigration · generateMigration · checkMigration
  db/                         # seed.ts
```

---

## Notes & caveats

- **Captcha solver is best-effort**: the slider offset ranking (NCC/std/border)
  is a heuristic port of the Python original; it retries up to
  `gateway.maxCaptchaRounds`. Portal UI/anti-bot changes can break it silently.
  Use `mode: 'mock'` for reliable UI testing; live runs are manual smoke tests.
- **Welcome gate is UX-only**: the welcome content is in the SSR bundle; the
  `/<slug>/welcome` route is gated client-side by a `sessionStorage` flag, not a
  security boundary.
- **Verify trust is convenience, not identity**: the `vg_verify` cookie lets a
  verified name+ID skip the portal across orgs; it authenticates the _fact of
  prior admission_, not a user account.
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
