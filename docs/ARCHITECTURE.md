# Architecture & Technical Design

> Companion to the [README](../README.md). This document covers implementation
> details: tech stack, database, auth, verification pipeline, email system, OCR,
> admin panel, API surface, and project structure.

---

## Tech stack

| Layer           | Technology                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Framework       | Nuxt 4 (SSR + Nitro server)                                                                        |
| Database        | SQLite via better-sqlite3                                                                          |
| ORM             | TypeORM (entities, `synchronize: true`)                                                            |
| Auth            | argon2id (`@noble/hashes`), revocable sessions, JWT (`jsonwebtoken`), passkeys (`@simplewebauthn`) |
| UI              | Tailwind CSS v4, shadcn-vue, reka-ui, lucide-vue-next                                              |
| i18n            | vue-i18n (per-org messages)                                                                        |
| Charts          | Chart.js + vue-chartjs                                                                             |
| OCR             | tesseract.js (offline, local traineddata)                                                          |
| Images          | sharp (resize, watermark, format conversion)                                                       |
| Email           | nodemailer / POST webhook, HTML template                                                           |
| Markdown        | markdown-it                                                                                        |
| Package manager | pnpm                                                                                               |

Node **≥ 24** required.

---

## System overview

**Nuxt 4 flat layout** (`srcDir: '.'`) — pages, components, layouts at the
project root (not under `app/`).

- **SSR** — each org's public page (`/<slug>`) is server-rendered with the
  org's config applied (theme vars, i18n, favicon) on first paint.
- **Nitro server** — API routes under `server/api/`, auto-imported utils under
  `server/utils/`, entities under `server/entities/`.
- **Shared code** — `shared/` dir auto-aliased to `#shared` (types, default
  config, validation, admission core). Server files import via relative paths
  or `#shared`.
- **Auto-imports** — server utils (functions + constants) are auto-imported by
  Nitro across the server bundle. Client-side composables/components are
  auto-imported by Nuxt.

---

## Database

Schema is defined by **TypeORM entities** in `server/entities/`. On boot,
`initDataSource()` runs `AppDataSource.initialize()` with `synchronize: true` —
TypeORM auto-creates/updates tables/columns from entities (additive: never drops
or alters existing data). No migration system.

**14 entity tables:**

| Table                | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `users`              | Accounts (email, password hash, role, locale, notifyExpiry) |
| `sessions`           | Revocable server-side sessions (30-day TTL)                 |
| `organizations`      | Org metadata (slug, name, ownerId)                          |
| `org_settings`       | Per-org JSON config (`SiteConfig`)                          |
| `org_images`         | Base64-encoded uploaded images (keyed by org + name)        |
| `org_members`        | Org memberships (userId, role, invite status/token)         |
| `org_events`         | Raw analytics event log (90-day retention)                  |
| `org_daily_stats`    | Permanent daily rollup per metric                           |
| `org_reminder_sents` | Idempotency tracking for QR-expiry reminder emails          |
| `passkeys`           | WebAuthn credentials                                        |
| `mail_configs`       | Site-wide SMTP/POST mail configuration                      |
| `app_settings`       | Generic key/value store (whitelist, origin tally)           |
| `verifications`      | Legacy/unused (leftover from earlier design)                |

---

## Auth & security

### Authentication flow

1. **Register**: email + password (min 8 chars) + email verification code.
   - Code requested via `POST /api/auth/send-code { email, session }` — 6-digit
     code, scoped to a client `session` token, stored in-memory (10-min TTL,
     5-attempt cap).
   - First registered user becomes `superadmin`.
2. **Login**: email + password, or passkey (WebAuthn discoverable credentials).
3. **Session**: revocable, server-side (`vg_session` httpOnly cookie, 30-day TTL).
   `server/middleware/session.ts` resolves → `event.context.user`.
4. **JWT trust cookies**:
   - `vg_jwt` — issued to logged-in users (7-day window).
   - `vg_verify` — issued to anonymous visitors after successful portal admission
     (name+ID-based, cross-org trust bypass).

### Password hashing

argon2id (`@noble/hashes`): t=2, m=19456, p=1, 16-byte random salt.

### Passkeys (WebAuthn)

`@simplewebauthn/server` v13. Relying party ID derived from request headers
(works on localhost, tunnels, and prod). Discoverable (usernameless) login.
Signed challenge cookie for ceremony security.

### Email verification

- **Registration**: 6-digit code emailed, scoped to client `session` token.
  Rate-limited: 1/min per email, 10/day.
- **Student/staff blocking**: addresses containing "student" or "staff" are
  blocked from registration, verification codes, and welcome-content emails
  (`isDisallowedEmail` in `server/utils/registration.ts`).

### Registration whitelist

Superadmin-controlled email-domain filter (picomatch globs like
`*@nottingham.edu.cn`). Stored in `app_settings`. First-ever registration always
bypasses (superadmin bootstrap).

### Rate limiting

`server/utils/emailLimit.ts` — sliding-window counters (in-memory):

| Scope                   | Per-target    | Per-account   |
| ----------------------- | ------------- | ------------- |
| Verification code       | 1/min, 10/day | —             |
| Welcome content         | 1/min, 10/day | —             |
| Invitation              | 1/min, 10/day | 6/min, 24/day |
| Test email (superadmin) | exempt        | exempt        |

Near-limit warnings surface as toasts (per-target >5/day; per-account ≥20/day).

### Roles

- **Site-level**: `superadmin` (first account) / `admin`.
- **Org-level**: `viewer` < `editor` < `manager` < `owner`. Superadmins bypass all.
- Enforced by `requireOrgRole` (`server/utils/members.ts`).

---

## Org configuration

Each org's entire configuration is a JSON `SiteConfig` stored in
`org_settings.config`. It includes:

- `messages` — per-locale i18n strings (brand, verify, errors, admission,
  welcome, theme, lang, footer, email).
- `icons` — lucide names or `{ img: 'img:<key>' }` for uploaded images.
- `welcome` — image ref, max width/radius, watermark toggle, expiry date,
  reminder slots + time.
- `theme` — primary color (hex), border radius.
- `background` — optional full-page image + overlay opacity.
- `gateway` — mode (live/mock), portal URL, captcha/timeout settings.

### Config loading & caching

`loadOrgConfig(slug)` (`server/utils/orgs.ts`):

1. Reads raw JSON from `org_settings`.
2. Applies defaults (`applyDefaults` fills empty strings).
3. Resolves `img:<key>` references → `data:` URLs (cached in-process).
4. Caches result (60s TTL). `invalidateOrgConfig(slug)` clears on save.

### Image resolution

`resolveImageRefs` (`server/utils/config.ts`) converts `img:<key>` → cached
`data:` URL by reading base64 from `org_images`. `resolveImgRef` (exported) lets
endpoints resolve individual refs (e.g., welcome image for OCR/email).

### i18n merge

`plugins/i18n.ts` deep-merges `defaultConfig.messages` into the vue-i18n base as
fallback. Org messages are applied on top by `applyOrgI18n` when the org layout
loads. Org messages are escaped (`escapeI18nMessages`) so user text with `@{}|`
doesn't break vue-i18n's parser.

---

## Verification pipeline

`POST /api/orgs/<slug>/check` — runs the ported `AdmissionClient`
(`shared/lib/admissionCore.ts`) server-side:

1. **Trust bypass** — if the `vg_verify` cookie matches name+ID, skip the portal.
2. **Mock mode** — if `gateway.mode === 'mock'`, admit any well-formed input.
3. **Live mode**:
   - Warmup (fetch session).
   - Slider captcha (NCC template-matching to rank offsets).
   - Submit (name, ID number, captcha answer).
   - Parse admission result.

The captcha solver is a TypeScript port of `ref/client.py`. It's best-effort —
portal UI changes can break it silently. Use mock mode for reliable testing.

---

## Statistics & privacy

### Data collection

- **`org_events`** — raw event log: type (view/verify), outcome, visitor meta
  (locale, region, device, browser, OS, referer, IP hash). Retained 90 days,
  then pruned.
- **`org_daily_stats`** — permanent daily rollup per org per metric.

### Privacy

- **Name**: stored plaintext (for display in welcome details).
- **ID number**: stored only as **salted SHA-256 hash** (never raw).
- **IP address**: stored only as **salted SHA-256 hash**.
- **Region**: inferred from `Accept-Language` header (no GeoIP database).
- **Salt**: derived from `SESSION_SECRET` (stable across restarts).

### Dashboard

- `/dashboard` — user's own orgs: aggregate KPIs, trend chart, per-org sparkline
  cards.
- `/dashboard/admin` — superadmin: site-wide analytics across all orgs.
- Charts: Chart.js/vue-chartjs in `<ClientOnly>`, registered in
  `plugins/chartjs.client.ts`.
- Reusable `StatsOverview` component (`components/dashboard/`) parameterized by
  endpoint.

---

## Email system

### Template

`email/template.html` — standalone HTML email (site-themed, light/dark via
`@media (prefers-color-scheme)`). Read at Nuxt config time, bundled into
`runtimeConfig.emailTemplate`. Placeholders: `{{TITLE}}`, `{{BODY}}`,
`{{ACTION_BLOCK}}`, `{{PREHEADER}}`, `{{YEAR}}`, `{{LOGO}}`.

### Rendering

`server/mail/render.ts` — `renderEmail(content)` replaces placeholders.
`content` includes title, bodyHtml (raw, caller-supplied), optional action
button, preheader.

### Per-org text

Org-scoped emails (invitation, reminder, welcome-content footer) read their
text from `config.messages.<locale>.email.*` via `emailMsg(config, locale, key)`
(`server/utils/emailText.ts`), with fallbacks:
org(locale) → org(en) → default(locale) → default(en).

Token replacement via `tpl(str, { org, role, date, n })` — `{org}` is wrapped in
an `<a>` (invite) or `<strong>` (reminder) by the endpoint.

### Mail providers

`server/utils/mail.ts` — `sendMailWithConfig` branches on provider:

- **SMTP** — nodemailer createTransport (host, port, SSL/STARTTLS, auth).
- **POST webhook** — HTTP POST with schema-specific payload (smtogo or
  powerautomate), bearer token auth.

### Disclaimer hiding

The UNNC mail relay appends a legal disclaimer. To hide it, outgoing emails set
the body's default text color to match the background (`color: #fafafa` on
`background-color: #fafafa` in light; `color: #0a0a0a` on `#0a0a0a` in dark via
`.bg` class). Unstyled disclaimer text becomes invisible; our content uses
explicit `color:` inline styles so it remains visible.

### Email Rate limiting

See [Auth & security → Rate limiting](#rate-limiting) above.

---

## OCR & QR-expiry reminders

### OCR pipeline

`server/utils/ocr.ts` — tesseract.js worker (chi_sim + chi_tra + eng, local
traineddata in `tessdata/`, `gzip: false`).

`ocrImage(buffer)` OCRs **tight bottom bands** (12% and 15% of height) — the QR
footer text lives at the very bottom; a band ≥20% includes the QR code and
defeats tesseract's segmentation. Bands are upscaled to 2800px for legibility.

`parseExpiryFromText` (`server/utils/qrExpiry.ts`) — regex-based date extraction:

1. Chinese absolute ("7月30日前").
2. English "Valid until M/D".
3. Generic M/D date.
4. Relative ("7天内" / "within 7 days").

All dates interpreted in server-local timezone. Year inferred for past dates
(rolls forward). Returns `null` on no match → caller falls back to manual entry.

### On upload

`POST /api/orgs/<slug>/images` — after saving the image, if `key === 'welcome'`,
runs `detectWelcomeExpiry(buffer)` → `toLocalDateStr(date)`. Returns `expiresAt`
in the response; the editor toasts the result and auto-fills the date field.

### Reminder scheduler

`server/plugins/02.reminders.ts` — on boot:

1. **Startup scan** (`autoEnableRemindersFromImages`): OCR-detects expiry dates
   from orgs with welcome images but no schedule; seeds default slots `[-1d,
'day-of']`.
2. **Periodic tick** (`sendDueReminders`, every 5 min + 30s after boot): for
   each org with `expiresAt` + active `reminders` slots:
   - Compute target time (slot day at `reminderTime`, server-local).
   - Send window: `[target, target + 24h)`.
   - Check `OrgReminderSent(orgId, expiresAt, slot)` for idempotency.
   - Recipients: **owner always** + active members with `notifyExpiry = true`.
   - Per-recipient localization via `User.locale`.

### Configurable reminder schedule

- **Slots**: `-3d` / `-2d` / `-1d` / `day-of` (multi-select in editor).
- **Time**: `welcome.reminderTime` (HH:MM, default 12:00).
- **Server clock**: displayed live in the editor (fetches `/api/server-time`,
  ticks client-side via offset).

---

## Admin panel

### Structure

- `/dashboard/admin` — **Admin Dashboard**: site-wide analytics overview.
- `/dashboard/admin/organizations` — **All Organizations**: org cards grouped by
  owner.
- `/dashboard/admin/organizations/<slug>` — **full org dashboard** (cloned route,
  see below).
- `/dashboard/admin/users` — user management.
- `/dashboard/admin/registration` — email whitelist.
- `/dashboard/admin/mail` — mail configuration.

### Route cloning

The org dashboard route subtree (`/dashboard/:slug` + children edit/advanced/
members/share/preview) is cloned to `/dashboard/admin/organizations/:slug` via
a `pages:extend` hook in `nuxt.config.ts`. The clone reuses the same Vue
components (no duplication) and injects the `superadmin` middleware. The layout's
org-tab logic detects the admin path and generates correct tab links.

### Dashboard scoping

`listAccessibleOrgs(userId)` returns owned ∪ shared memberships (no superadmin
special-casing — superadmins see their own orgs like anyone else on the
dashboard). The admin "All Organizations" view uses a separate `/api/admin/orgs`
(superadmin-only) that lists every org with owner info.

### Site origin detection

`server/utils/siteOrigin.ts` — tallies visitor origins from request headers
(`${proto}://${host}`). The most-observed origin is used as the canonical public
URL for background-email links (reminders). Tally persisted in `app_settings`
(`site.originTally`), survives restarts. `SITE_URL` env as cold-start fallback.

---

## API surface

| Area    | Method · Path                            | Auth       | Notes                                                     |
| ------- | ---------------------------------------- | ---------- | --------------------------------------------------------- |
| Auth    | `POST /api/auth/register`                | public*    | first user → superadmin; requires email verification code |
|         | `POST /api/auth/send-code`               | public     | sends 6-digit verification code                           |
|         | `POST /api/auth/login`                   | public     |                                                           |
|         | `POST /api/auth/logout`                  | session    | clears session + JWT cookies                              |
|         | `GET /api/auth/me`                       | session    | current user + notifyExpiry                               |
|         | `PATCH /api/auth/me`                     | session    | change email/password/notifyExpiry                        |
| Passkey | `GET /api/auth/passkey`                  | session    | list own passkeys                                         |
|         | `GET /api/auth/passkey/register-options` | session    | add-passkey ceremony                                      |
|         | `POST /api/auth/passkey/register-verify` | session    | verify + store                                            |
|         | `GET /api/auth/passkey/login-options`    | public     | passkey-login ceremony                                    |
|         | `POST /api/auth/passkey/login-verify`    | public     | verify → create session                                   |
|         | `DELETE /api/auth/passkey/<id>`          | session    | remove own passkey                                        |
| Orgs    | `GET /api/orgs`                          | session    | accessible orgs (owned ∪ shared)                          |
|         | `POST /api/orgs`                         | session    | create org                                                |
|         | `POST /api/orgs/validate`                | session    | slug + config validation                                  |
|         | `GET /api/orgs/<slug>/config`            | —          | resolved public config (SSR)                              |
|         | `GET /api/orgs/<slug>/config?edit`       | viewer+    | raw config for editor                                     |
|         | `PUT /api/orgs/<slug>/config`            | editor+    | save edited config                                        |
|         | `DELETE /api/orgs/<slug>`                | owner/SA   | cascade-deletes everything                                |
|         | `POST /api/orgs/<slug>/check`            | —          | run verification                                          |
|         | `POST /api/orgs/<slug>/track`            | —          | public page-view beacon                                   |
|         | `POST /api/orgs/<slug>/images`           | editor+    | upload image → `img:<key>` (OCR on welcome)               |
|         | `GET /api/orgs/<slug>/welcome-image`     | —          | welcome image (optionally watermarked)                    |
|         | `POST /api/orgs/<slug>/email-page`       | —          | email welcome content to @nottingham.edu.cn               |
|         | `GET /api/orgs/<slug>/stats`             | viewer+    | totals + daily series + breakdowns                        |
|         | `GET /api/orgs/<slug>/access`            | viewer+    | caller's role on this org                                 |
| Sharing | `GET /api/orgs/<slug>/members`           | manager+   | list members + owner                                      |
|         | `POST /api/orgs/<slug>/members`          | manager+   | invite by email → link                                    |
|         | `PATCH /api/orgs/<slug>/members/<id>`    | manager+   | change role                                               |
|         | `DELETE /api/orgs/<slug>/members/<id>`   | manager+   | remove (or self-leave)                                    |
|         | `POST /api/orgs/<slug>/transfer`         | owner+     | transfer ownership                                        |
|         | `GET /api/orgs/<slug>/invitation`        | session    | pending invite for user's email                           |
| Stats   | `GET /api/stats/overview`                | session    | cross-org dashboard data                                  |
| Admin   | `GET /api/admin/users`                   | superadmin |                                                           |
|         | `PATCH /api/admin/users/<id>`            | superadmin | set role                                                  |
|         | `DELETE /api/admin/users/<id>`           | superadmin | delete user                                               |
|         | `GET /api/admin/orgs`                    | superadmin | all orgs + owner info                                     |
|         | `GET /api/admin/stats/overview`          | superadmin | site-wide analytics                                       |
|         | `GET /api/admin/registration`            | superadmin | email-whitelist config                                    |
|         | `PUT /api/admin/registration`            | superadmin | update whitelist                                          |
| Mail    | `GET /api/mail/config`                   | superadmin | SMTP/POST config                                          |
|         | `PUT /api/mail/config`                   | superadmin | update config                                             |
|         | `POST /api/mail/test`                    | superadmin | send test email (no rate limit)                           |
| Misc    | `GET /api/icon.svg`                      | —          | lucide name → SVG                                         |
|         | `GET /api/server-time`                   | —          | server ISO time + IANA timezone                           |

\* Register subject to the email whitelist. First-ever registration always bypasses.

---

## Project structure

```bash
.
├── assets/css/main.css       # Tailwind v4 + shadcn theme
├── components/
│   ├── admin/                # ConfigEditor · IconPicker · ImageUploader · ImagePreview · LocaleField
│   ├── dashboard/            # StatsOverview (reusable KPI + chart)
│   ├── public/               # BrandMark · Icon · VerifyForm · WelcomeContent · OrgLinkActions
│   └── ui/                   # shadcn-vue: button · card · input · label · breadcrumb
├── composables/              # useAuth · useBreadcrumbs · useOrgConfig · useOrgDraft · useOrgI18n · useVerifier
├── docs/ARCHITECTURE.md      # this file
├── email/template.html       # HTML email template (site-themed, dark mode)
├── layouts/                  # auth · dashboard · default (per-org)
├── lib/                      # verify · icon · iconAllowlist · markdown · utils
├── middleware/               # auth · guest · superadmin · preview-guard · welcome-gate
├── pages/
│   ├── [slug]/{index,welcome,invitations}.vue     # PUBLIC per-org gateway
│   ├── [slug]/preview/{index,welcome}.vue          # auth+ownership-gated preview
│   ├── dashboard/[slug]/{index,edit,advanced,members,share,preview}.vue
│   ├── dashboard/admin/{index,organizations,users,registration,mail}.vue
│   ├── dashboard/{index,new,orgs,settings}.vue
│   ├── index.vue · login.vue · register.vue
├── plugins/                  # i18n · auth · chartjs.client · 01.db · 02.reminders · 03.site-origin
├── public/favicon.svg
├── server/
│   ├── api/                  # auth · orgs · admin · mail · stats · invites · icon.svg · server-time
│   ├── entities/             # 14 TypeORM entities
│   ├── mail/render.ts        # HTML email renderer
│   ├── middleware/           # session · origin (tally visitor origins)
│   ├── plugins/              # 01.db (init) · 02.reminders (scheduler) · 03.site-origin (tally flush)
│   └── utils/                # database · auth · jwt · members · orgs · config · admission · stats · ocr · qrExpiry · reminders · emailText · emailLimit · siteOrigin · mail · registration · request · watermark · png
├── shared/                   # app↔server code (#shared alias)
│   ├── types.ts
│   └── lib/                  # admissionCore · applyDefaults · defaultConfig · escapeMessage · validateConfig
├── tessdata/                 # OCR traineddata (chi_sim, chi_tra, eng)
├── Dockerfile · docker-compose.yml
└── nuxt.config.ts · package.json · tsconfig.json
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
- **`verifications` table** is legacy/unused (leftover from an earlier design).
- **Rate limits are in-memory** (single-instance only); multi-instance deploys
  need a shared store (Redis).
- **OCR is offline**: traineddata bundled in `tessdata/` (~10 MB, committed).
  No CDN dependency.
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
