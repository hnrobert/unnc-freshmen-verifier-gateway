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
| i18n            | vue-i18n (per-page messages)                                                                       |
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

- **SSR** — each public page (`/<slug>`) is server-rendered with the
  page's config applied (theme vars, i18n, favicon) on first paint.
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

**16 entity tables** (physical names keep the `org_*` prefix by design — the
code-level concept is "page", mapped through entity decorators; see
[DATABASE-NAMING.md](DATABASE-NAMING.md)):

| Table                         | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `users`                       | Accounts (email, password hash, role, locale, notifyExpiry) |
| `sessions`                    | Revocable server-side sessions (30-day TTL)                 |
| `organizations`               | Page metadata (slug, name, ownerId)                         |
| `org_settings`                | Per-page JSON config (`SiteConfig`)                         |
| `org_images`                  | Base64-encoded uploaded images (keyed by page + name)       |
| `org_members`                 | Page memberships (userId, role, invite status/token)        |
| `org_events`                  | Raw analytics event log (90-day retention)                  |
| `org_daily_stats`             | Permanent daily rollup per metric                           |
| `org_reminder_sents`          | Idempotency tracking for QR-expiry reminder emails          |
| `org_redirects`               | Old-slug → new-slug redirects after renames                 |
| `org_verified_identities`     | Cross-page trust: verified name+ID (hashed)                 |
| `user_org_notification_prefs` | Per-user per-page reminder overrides                        |
| `audit_events`                | Admin audit log                                             |
| `passkeys`                    | WebAuthn credentials                                        |
| `mail_configs`                | Site-wide SMTP/POST mail configuration                      |
| `app_settings`                | Generic key/value store (whitelist, limits, origin tally)   |

Two additional legacy tables (`verifications`, `migrations`) exist in older
databases from earlier designs — no entity maps to them anymore.

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
     (name+ID-based, cross-page trust bypass).

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
- **Page-level**: `viewer` < `editor` < `manager` < `owner`. Superadmins bypass all.
- Enforced by `requirePageRole` (`server/utils/members.ts`).

---

## Page configuration

Each page's entire configuration is a JSON `SiteConfig` stored in
`org_settings.config`. It includes:

- `messages` — per-locale i18n strings (brand, verify, errors, admission,
  welcome, theme, lang, footer, email).
- `icons` — lucide names or `{ img: 'img:<key>' }` for uploaded images.
- `welcome` — image ref, max width/radius, watermark toggle, QR expiry date
  (reminder _schedules_ are per-user — see "Per-user reminder preferences").
- `theme` — primary color (hex), border radius.
- `background` — optional full-page image + overlay opacity.
- `gateway` — mode (live/mock), portal URL, captcha/timeout settings.

### Config loading & caching

`loadPageConfig(slug)` (`server/utils/pages.ts`):

1. Reads raw JSON from `org_settings`.
2. Applies defaults (`applyDefaults` fills empty strings).
3. Resolves `img:<key>` references → `data:` URLs (cached in-process).
4. Caches result (60s TTL). `invalidatePageConfig(slug)` clears on save.

### Image resolution

`resolveImageRefs` (`server/utils/config.ts`) converts `img:<key>` → cached
`data:` URL by reading base64 from `org_images`. `resolveImgRef` (exported) lets
endpoints resolve individual refs (e.g., welcome image for OCR/email).

### i18n merge

`plugins/i18n.ts` deep-merges `defaultConfig.messages` into the vue-i18n base as
fallback. Page messages are applied on top by `applyPageI18n` when the page layout
loads. Page messages are escaped (`escapeI18nMessages`) so user text with `@{}|`
doesn't break vue-i18n's parser.

---

## Verification pipeline

`POST /api/pages/<slug>/check` — runs the ported `AdmissionClient`
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
- **`org_daily_stats`** — permanent daily rollup per page per metric.

### Privacy

- **Name**: stored plaintext (for display in welcome details).
- **ID number**: stored only as **salted SHA-256 hash** (never raw).
- **IP address**: stored only as **salted SHA-256 hash**.
- **Region**: inferred from `Accept-Language` header (no GeoIP database).
- **Salt**: derived from `SESSION_SECRET` (stable across restarts).

### Dashboard

- `/dashboard` — user's own pages: aggregate KPIs, trend chart, per-page sparkline
  cards.
- `/dashboard/admin` — superadmin: site-wide analytics across all pages.
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

### Per-page text

Page-scoped emails (invitation, reminder, welcome-content footer) read their
text from `config.messages.<locale>.email.*` via `emailMsg(config, locale, key)`
(`server/utils/emailText.ts`), with fallbacks:
page(locale) → page(en) → default(locale) → default(en).

Token replacement via `tpl(str, { org, role, date, n })` — `{org}` is wrapped in
an `<a>` (invite) or `<strong>` (reminder) by the endpoint.

### Mail providers

`server/utils/mail.ts` — `sendMailWithConfig` branches on provider:

- **SMTP** — nodemailer createTransport (host, port, SSL/STARTTLS, auth).
- **POST webhook** — HTTP POST with schema-specific payload (smtogo or
  custom_example), bearer token auth.

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

`POST /api/pages/<slug>/images` — after saving the image, if `key === 'welcome'`,
runs `detectWelcomeExpiry(buffer)` → `toLocalDateStr(date)`. Returns `expiresAt`
in the response; the editor toasts the result and auto-fills the date field.

### Reminder scheduler

`server/plugins/02.reminders.ts` — on boot:

1. **Startup scan** (`autoEnableRemindersFromImages`): OCR-detects expiry dates
   from pages with a welcome image but no `expiresAt` yet (manual dates are
   never overwritten). Schedules are **not** set here — they are per-user.
2. **Periodic tick** (`sendDueReminders`, every 5 min + 30s after boot): for
   each page with `expiresAt`, every recipient (owner + active members) is
   reminded on **their own** resolved schedule:
   - Compute target time (slot day at the recipient's time, in the recipient's
     timezone — `resolveEffectivePref`, see below).
   - Send window: `[target, target + 24h)`.
   - Check `PageReminderSent(pageId, userId, expiresAt, slot)` for idempotency
     (row is claimed before sending → race-safe).
   - Recipients: owner + active members; each filtered by their own preference.
   - Per-recipient localization via `User.locale`.

### Per-user reminder preferences

Schedules live on the **user**, not the page (the page only supplies
`welcome.expiresAt`). Resolved by `resolveEffectivePref`
(`shared/lib/reminderPref.ts`), tiers highest-first:

1. **Per-page override** — `UserPageNotificationPref` (the page's Notifications
   tab; any `null` field falls through, `[]` slots = explicitly off).
2. **Account default** — `User.{notifyExpiry, reminderSlots, reminderTime, tz}`
   (account Settings page).
3. **System default** — `['-2d','-1d','day-of']` @ 12:00, server timezone.

Timezone chain: `user.tz` → server tz. The QR-expiry _date_ stays page-level
(`welcome.expiresAt`, editor-set / OCR-detected).

---

## Admin panel

### Structure

- `/dashboard/admin` — **Admin Dashboard**: site-wide analytics overview.
- `/dashboard/admin/pages` — **All Pages**: page cards grouped by
  owner.
- `/dashboard/admin/pages/<slug>` — **full page dashboard** (cloned route,
  see below).
- `/dashboard/admin/users` — user management.
- `/dashboard/admin/registration` — email whitelist.
- `/dashboard/admin/mail` — mail configuration.

### Route cloning

The page dashboard route subtree (`/dashboard/:slug` + children edit/advanced/
members/share/preview) is cloned to `/dashboard/admin/pages/:slug` via
a `pages:extend` hook in `nuxt.config.ts`. The clone reuses the same Vue
components (no duplication) and injects the `superadmin` middleware. The layout's
page-tab logic detects the admin path and generates correct tab links.

### Dashboard scoping

`listAccessiblePages(userId)` returns owned ∪ shared memberships (no superadmin
special-casing — superadmins see their own pages like anyone else on the
dashboard). The admin "All Pages" view uses a separate `/api/admin/pages`
(superadmin-only) that lists every page with owner info.

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
| Pages   | `GET /api/pages`                         | session    | accessible pages (owned ∪ shared)                         |
|         | `POST /api/pages`                        | session    | create page                                               |
|         | `POST /api/pages/validate`               | session    | slug + config validation                                  |
|         | `GET /api/pages/<slug>/config`           | —          | resolved public config (SSR)                              |
|         | `GET /api/pages/<slug>/config?edit`      | viewer+    | raw config for editor                                     |
|         | `PUT /api/pages/<slug>/config`           | editor+    | save edited config                                        |
|         | `DELETE /api/pages/<slug>`               | owner/SA   | cascade-deletes everything                                |
|         | `POST /api/pages/<slug>/check`           | —          | run verification                                          |
|         | `POST /api/pages/<slug>/track`           | —          | public page-view beacon                                   |
|         | `POST /api/pages/<slug>/images`          | editor+    | upload image → `img:<key>` (OCR on welcome)               |
|         | `GET /api/pages/<slug>/welcome-image`    | —          | welcome image (optionally watermarked)                    |
|         | `POST /api/pages/<slug>/email-page`      | —          | email welcome content to @nottingham.edu.cn               |
|         | `GET /api/pages/<slug>/stats`            | viewer+    | totals + daily series + breakdowns                        |
|         | `GET /api/pages/<slug>/access`           | viewer+    | caller's role on this page                                |
| Sharing | `GET /api/pages/<slug>/members`          | manager+   | list members + owner                                      |
|         | `POST /api/pages/<slug>/members`         | manager+   | invite by email → link                                    |
|         | `PATCH /api/pages/<slug>/members/<id>`   | manager+   | change role                                               |
|         | `DELETE /api/pages/<slug>/members/<id>`  | manager+   | remove (or self-leave)                                    |
|         | `POST /api/pages/<slug>/transfer`        | owner+     | transfer ownership                                        |
|         | `GET /api/pages/<slug>/invitation`       | session    | pending invite for user's email                           |
| Stats   | `GET /api/stats/overview`                | session    | cross-page dashboard data                                 |
| Admin   | `GET /api/admin/users`                   | superadmin |                                                           |
|         | `PATCH /api/admin/users/<id>`            | superadmin | set role                                                  |
|         | `DELETE /api/admin/users/<id>`           | superadmin | delete user                                               |
|         | `GET /api/admin/pages`                   | superadmin | all pages + owner info                                    |
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
│   ├── public/               # BrandMark · Icon · VerifyForm · WelcomeContent · PageLinkActions
│   └── ui/                   # shadcn-vue: button · card · input · label · breadcrumb
├── composables/              # useAuth · useBreadcrumbs · usePageConfig · usePageDraft · usePageI18n · useVerifier
├── docs/ARCHITECTURE.md      # this file
├── email/template.html       # HTML email template (site-themed, dark mode)
├── layouts/                  # auth · dashboard · default (per-page)
├── lib/                      # verify · icon · iconAllowlist · markdown · utils
├── middleware/               # auth · guest · superadmin · preview-guard · welcome-gate
├── pages/
│   ├── [slug]/{index,welcome,invitations}.vue     # PUBLIC per-page gateway
│   ├── [slug]/preview/{index,welcome}.vue          # auth+ownership-gated preview
│   ├── dashboard/[slug]/{index,edit,advanced,members,share,preview}.vue
│   ├── dashboard/admin/{index,pages,users,registration,mail}.vue
│   ├── dashboard/{index,new,pages,settings}.vue
│   ├── index.vue · login.vue · register.vue
├── plugins/                  # i18n · auth · chartjs.client · 01.db · 02.reminders · 03.site-origin
├── public/favicon.svg
├── server/
│   ├── api/                  # auth · pages · admin · mail · stats · invites · icon.svg · timezones
│   ├── entities/             # 16 TypeORM entities (DB keeps `org_*` names — see docs/DATABASE-NAMING.md)
│   ├── mail/render.ts        # HTML email renderer
│   ├── middleware/           # session · origin (tally visitor origins) · page-slug-redirect
│   ├── plugins/              # 01.db (init) · 02.reminders (scheduler) · 03.site-origin (tally flush) · 03.reminders-migration
│   └── utils/                # database · auth · jwt · members · pages · config · admission · stats · ocr · qrExpiry · reminders · emailText · emailLimit · siteOrigin · mail · registration · request · watermark · png
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
  verified name+ID skip the portal across pages.
- **`verifications` table** is legacy/unused (leftover from an earlier design).
- **Rate limits are in-memory** (single-instance only); multi-instance deploys
  need a shared store (Redis).
- **OCR is offline**: traineddata bundled in `tessdata/` (~10 MB, committed).
  No CDN dependency.
- For legal/ethical use only — don't bulk-query the portal; ID numbers are
  sensitive personal data.
