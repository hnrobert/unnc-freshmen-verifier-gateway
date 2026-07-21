# UNNC Freshmen Verifier Gateway

A **multi-tenant** verify-gateway built with **Nuxt 4 + SQLite**. Users register,
create **organizations** (each at `/<slug>`), and fully customize their own
bilingual (中文 / English) verify page — i18n labels, icons, welcome image and
Markdown body, theme, background, and gateway settings — through a GitHub-style
web editor with **live preview**. Verification queries the **live UNNC admission
portal** server-side (a faithful TypeScript port of `ref/client.py`, slider-captcha
solver included).

---

## Tech stack

Nuxt 4 (SSR + Nitro) · SQLite (better-sqlite3) · **TypeORM** (entities,
`synchronize`) · argon2id passwords (`@noble/hashes`) · revocable sessions +
JWT trust cookies (`jsonwebtoken`) · **passkeys** (`@simplewebauthn`) ·
vue-i18n · Tailwind CSS v4 + shadcn-vue + reka-ui · lucide-vue-next + @lucide/vue ·
markdown-it · pngjs · Chart.js/vue-chartjs · ua-parser-js · qrcode ·
nodemailer · vue-sonner · picomatch · pnpm

> Node **>= 24** is required (the Docker image uses `node:24-slim`).

---

## Quick start

```bash
pnpm install          # installs deps + runs nuxt prepare
pnpm dev              # http://localhost:3000
```

The schema is **auto-synced** from TypeORM entities on boot (`synchronize: true`)
— no migration commands needed. The first user to register becomes `superadmin`.

---

## How it works

### Auth & accounts

- **Register / login**: email + password (min 8 chars), argon2id-hashed.
- **Passkeys (WebAuthn)**: optional passwordless login via `@simplewebauthn`.
  Users add a passkey in account settings; the login page shows a
  **"Sign in with passkey"** button. Discoverable (usernameless) login.
  Requires HTTPS or `http://localhost`.
- **Sessions**: revocable, server-side (`vg_session` httpOnly cookie, 30-day TTL).
  `server/middleware/session.ts` resolves the session → `event.context.user`.
- **JWT trust cookies** (`jsonwebtoken`, 7-day window):
  - `vg_jwt` — issued to logged-in users.
  - `vg_verify` — issued to anonymous visitors after a successful portal admission
    (name+ID-based, cross-org trust).
- **Registration whitelist**: superadmin-controlled email-domain/pattern filter
  (picomatch globs). The first registration always bypasses it (superadmin bootstrap).
- **Roles**: site-level `superadmin` (first account) / `admin`. Org-level
  `viewer` < `editor` < `manager` < `owner`. Superadmins bypass all org checks.
- **Account settings** (`/dashboard/settings`): change email/password, manage
  passkeys.

### Organizations

Each org has a GitHub-style **5-panel dashboard** at `/dashboard/<slug>` with a
shared top bar (org name + **org switcher** + role-gated tabs):

- **Home** — data/statistics + **danger zone** (delete org, owner-only).
- **Edit** — basic config (theme color, locales, background/welcome image,
  brand, welcome page content).
- **Advanced** — verify/error/admission labels, other icons, gateway settings,
  theme radius.
- **Members** — invite by email link, manage roles, transfer ownership,
  self-leave.
- **Share** — QR code for the public `/<slug>` URL + download PNG + copy link.

**Org sharing**: owner invites users by email (one-time token link); recipient
must sign in with the invited email. Roles: `viewer` (read-only) / `editor`
(can edit) / `manager` (can manage members). Only owner invites managers or
transfers ownership.

**The Organizations list** (`/dashboard/orgs`) shows one card per org:
name (→ Home), Share button, View ↗ (public page). Minimal and clean.

### Per-org configuration

- `org_settings.config` — a JSON `SiteConfig` (every label, icon, welcome
  Markdown, theme, background, gateway setting). Loaded config is cached (60s TTL).
- **Images** stored as base64 in `org_images`, referenced by `img:<key>`,
  resolved to `data:` URLs at render time.
- **Theming**: per-org border radius + primary color (CSS vars), per-org favicon,
  optional full-page background image, no-FOUC dark mode.
- **Verification**: `POST /api/orgs/<slug>/check` runs the ported `AdmissionClient`
  server-side (warmup → slider captcha → submit → parse). Resolution order:
  1. **Trust bypass** (vg_verify cookie matches name+ID).
  2. **Mock mode** (`gateway.mode: 'mock'`).
  3. **Live mode** (query the portal).

### Statistics

Per-org analytics in SQLite: page views + unique visitors, verification
outcomes (admitted / not-found / error) + modes (live / mock / trusted), and
visitor profile (locale+region, device/browser/OS, referer).

- **`org_events`** — raw event log, retained **90 days** then pruned.
- **`org_daily_stats`** — permanent daily rollup (powers trend charts).
- **Privacy**: visitor name stored plaintext; **ID number and IP stored only as
  salted SHA-256 hashes** — never raw. Region inferred from Accept-Language
  (no GeoIP DB).
- **Dashboard 看板** (`/dashboard`): cross-org aggregate overview with KPIs,
  trend charts (Chart.js/vue-chartjs), and per-org cards with SVG sparklines.
- Charts wrapped in `<ClientOnly>`; Chart.js components registered in
  `plugins/chartjs.client.ts`.

### Email

- HTML email template at `email/template.html` (site-themed, light/dark via
  `prefers-color-scheme`), rendered by `server/mail/render.ts`.
- Site-wide SMTP config (`mail_configs` entity, superadmin-owned via the admin
  Mail tab).
- `POST /api/mail/test` sends a test email using the template.

### Footer

A unified `SiteFooter` component on **all** pages (public, auth, dashboard):
`© <year> UNNC Freshmen Verifier Gateway · Apache-2.0 · GitHub · Made with ♥ by
Robert He`. No per-org footer customization.

---

## API surface

| Area    | Method · Path                            | Auth       | Notes                              |
| ------- | ---------------------------------------- | ---------- | ---------------------------------- |
| Auth    | `POST /api/auth/register`                | public*    | first user → `superadmin`          |
|         | `POST /api/auth/login`                   | public     |                                    |
|         | `POST /api/auth/logout`                  | —          | clears session + JWT cookies       |
|         | `GET /api/auth/me`                       | session    | current user                       |
|         | `PATCH /api/auth/me`                     | session    | change email and/or password       |
| Passkey | `GET /api/auth/passkey`                  | session    | list own passkeys                  |
|         | `GET /api/auth/passkey/register-options` | session    | add-passkey ceremony               |
|         | `POST /api/auth/passkey/register-verify` | session    | verify + store                     |
|         | `GET /api/auth/passkey/login-options`    | public     | passkey-login ceremony             |
|         | `POST /api/auth/passkey/login-verify`    | public     | verify → create session            |
|         | `DELETE /api/auth/passkey/<id>`          | session    | remove own passkey                 |
| Orgs    | `GET /api/orgs`                          | session    | accessible orgs (owned ∪ shared)   |
|         | `POST /api/orgs`                         | session    | create org                         |
|         | `POST /api/orgs/validate`                | session    | slug + config validation           |
|         | `GET /api/orgs/<slug>/config`            | —          | resolved public config (SSR)       |
|         | `GET /api/orgs/<slug>/config?edit`       | viewer+    | raw config for the editor          |
|         | `PUT /api/orgs/<slug>/config`            | editor+    | save edited config                 |
|         | `DELETE /api/orgs/<slug>`                | owner/SA   | cascade-deletes everything         |
|         | `POST /api/orgs/<slug>/check`            | —          | run verification                   |
|         | `POST /api/orgs/<slug>/track`            | —          | public page-view beacon            |
|         | `POST /api/orgs/<slug>/images`           | editor+    | upload image → `img:<key>`         |
|         | `GET /api/orgs/<slug>/img/<key>`         | —          | serve stored image                 |
|         | `GET /api/orgs/<slug>/stats`             | viewer+    | totals + daily series + breakdowns |
|         | `GET /api/orgs/<slug>/access`            | viewer+    | caller's role on this org          |
| Sharing | `GET /api/orgs/<slug>/members`           | manager+   | list members + owner               |
|         | `POST /api/orgs/<slug>/members`          | manager+   | invite by email → link             |
|         | `PATCH /api/orgs/<slug>/members/<id>`    | manager+   | change role                        |
|         | `DELETE /api/orgs/<slug>/members/<id>`   | manager+   | remove (or self-leave)             |
|         | `POST /api/orgs/<slug>/transfer`         | owner+     | transfer ownership                 |
|         | `GET /api/invites/<token>`               | —          | invite details (landing page)      |
|         | `POST /api/invites/<token>/claim`        | session    | claim (email must match)           |
| Stats   | `GET /api/stats/overview`                | session    | cross-org dashboard data           |
| Admin   | `GET /api/admin/users`                   | superadmin |                                    |
|         | `PATCH /api/admin/users/<id>`            | superadmin | set role                           |
|         | `GET /api/admin/orgs`                    | superadmin | all orgs + owner emails            |
|         | `GET /api/admin/registration`            | superadmin | email-whitelist config             |
|         | `PUT /api/admin/registration`            | superadmin | update whitelist                   |
| Mail    | `GET /api/mail/config`                   | superadmin | SMTP/sender config                 |
|         | `PUT /api/mail/config`                   | superadmin | update config                      |
|         | `POST /api/mail/test`                    | superadmin | send test email                    |
| Misc    | `GET /api/icon.svg`                      | —          | lucide name → SVG favicon          |

\* Register subject to the email whitelist (superadmin-controlled). First-ever
registration always bypasses.

Roles: viewer < editor < manager < owner < superadmin, enforced by
`requireOrgRole` (`server/utils/members.ts`).

---

## Database

Schema is defined by **TypeORM entities** in `server/entities/`. On boot,
`initDataSource()` calls `AppDataSource.initialize()` which runs
**`synchronize: true`** — TypeORM auto-creates missing tables/columns from the
entities (additive: never drops or alters existing data). No migration system.

12 entity tables: `users`, `sessions`, `organizations`, `org_settings`,
`org_images`, `verifications` (legacy, unused), `app_settings`, `passkeys`,
`org_members`, `org_events`, `org_daily_stats`, `mail_configs`.

---

## Scripts

| Script                         | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `pnpm dev`                     | Nuxt dev server (auto-syncs schema on boot)         |
| `pnpm build`                   | Production build → `.output/`                       |
| `pnpm preview`                 | Preview the build (`node .output/server/index.mjs`) |
| `pnpm typecheck`               | `nuxt typecheck`                                    |
| `pnpm test`                    | Self-test for the captcha solver + parser           |
| `pnpm format` / `format:check` | Prettier write / check                              |

Pre-commit (`lint-staged`): formats staged files with Prettier.
Commit-msg: validates gitflow convention (`feat:` / `fix:` / …).

---

## Production deployment

Nuxt SSR needs a persistent Node host (SQLite is a file). Required env vars:

- `SESSION_SECRET` — cookie/JWT signing secret (**change** from the dev default).
- `DB_PATH` — SQLite file path (on a persistent volume).
- `PORT` — listen port (defaults to 3000).

### Docker

```bash
SESSION_SECRET=... docker compose up --build -d
```

The `docker-compose.yml` builds the multi-stage image (`node:24-slim`), mounts a
named volume at `/app/data`, and starts `.output/server/index.mjs`. The schema
auto-syncs on boot.

`Secure` is set on auth cookies only when the request is genuinely HTTPS
(`server/utils/request.ts`), so logins work over HTTP tunnels forwarding
`X-Forwarded-Proto: https`.

---

## Project structure

```bash
.
├── assets/css/main.css
├── components/
│   ├── admin/          # ConfigEditor (basic|advanced) · IconPicker · ImageUploader · ImagePreview · LocaleField · MarkdownEditor
│   ├── public/         # BrandMark · Icon · LanguageToggle · ThemeToggle · StatusAlert · VerifyForm · WelcomeContent · MarkdownView · OrgLinkActions
│   ├── ui/             # shadcn-vue: breadcrumb (reka-ui) · button · card · input · label
│   ├── SaveBar.vue
│   ├── SiteFooter.vue
│   └── UnsavedLeaveDialog.vue
├── composables/        # useAuth · useAuthForm · useBreadcrumbs · useOrgConfig · useOrgDraft · useOrgI18n · useUnsavedLeaveGuard · useVerifier
├── email/template.html # standalone HTML email template (site-themed, dark mode)
├── layouts/            # auth · dashboard · default (per-org)
├── lib/                # verify · icon · iconAllowlist · markdown · utils
├── middleware/         # auth · guest · superadmin · preview-guard · welcome-gate
├── pages/
│   ├── [slug]/{index,welcome}.vue             # PUBLIC per-org gateway
│   ├── [slug]/preview/{index,welcome}.vue     # auth+ownership-gated live preview
│   ├── dashboard/[slug].vue                   # parent layout (org header + tabs + switcher)
│   ├── dashboard/[slug]/{index,edit,advanced,members,share}.vue
│   ├── dashboard/admin/{index,users,registration,mail}.vue
│   ├── dashboard/{index,new,orgs,settings}.vue
│   ├── invite/[token].vue                     # invite landing (claim on login)
│   ├── index.vue · login.vue · register.vue
├── plugins/            # i18n · auth · chartjs.client
├── public/favicon.svg
├── server/             # Nitro
│   ├── api/
│   │   ├── auth/       # register · login · logout · me.{get,patch} · passkey/*
│   │   ├── orgs/       # index.{get,post} · validate · [slug]/{config.{get,put}, check, track, stats, access, images, img/[key], members*, transfer, index.delete}
│   │   ├── stats/      # overview.get (cross-org dashboard)
│   │   ├── invites/    # [token].get · [token]/claim.post
│   │   ├── admin/      # users · users/[id].patch · orgs · registration.{get,put}
│   │   ├── mail/       # config.{get,put} · test.post
│   │   └── icon.svg.get
│   ├── entities/       # 12 TypeORM entities (users · sessions · organizations · org_settings · org_images · verifications · app_settings · passkeys · org_members · org_events · org_daily_stats · mail_configs)
│   ├── mail/render.ts  # HTML email template renderer
│   ├── middleware/session.ts   # resolves session → event.context.user
│   ├── plugins/01.db.ts        # init DataSource (synchronize) on boot
│   └── utils/          # database · auth · jwt · members · orgs · config · admission · stats · webauthn · mail · registration · request · png
├── shared/             # app↔server code (auto-aliased to #shared)
│   ├── types.ts
│   └── lib/            # admissionCore · applyDefaults · defaultConfig · escapeMessage · validateConfig
├── utils/errors.ts     # auto-imported
├── Dockerfile · docker-compose.yml
├── app.vue · nuxt.config.ts · components.json
└── package.json · tsconfig.json · pnpm-workspace.yaml
```

---

## Notes & caveats

- **Captcha solver is best-effort**: the slider offset ranking (NCC/std/border)
  is a heuristic port of the Python original. Portal UI/anti-bot changes can
  break it silently. Use `mode: 'mock'` for reliable UI testing.
- **Welcome gate is UX-only**: the `/<slug>/welcome` route is gated client-side
  by a `sessionStorage` flag, not a security boundary.
- **Verify trust is convenience, not identity**: the `vg_verify` cookie lets a
  verified name+ID skip the portal across orgs.
- **`verifications` table** is legacy/unused (leftover from an earlier design);
  harmless dead schema.
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
