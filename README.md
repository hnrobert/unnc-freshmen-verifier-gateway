# UNNC Freshmen Verifier Gateway

A **multi-tenant verification platform** that lets UNNC student teams create
their own branded, bilingual (中文 / English) admission-verification pages.
Every page is a fully customizable public site at
`/<page-slug>` where new students enter their name and ID number to check
admission status in real time — queried against the **live UNNC admission
portal** with an automatic slider-captcha solver.

> For technical implementation details (architecture, database schema, API
> surface, security model), see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Features

### Fully customizable pages

Each page ships with:

- **Bilingual support** — every label, hint, and error message editable in both
  Chinese and English via a live-preview editor.
- **Theming** — custom primary color, border radius, favicon, optional full-page
  background image, and automatic dark mode.
- **Brand identity** — custom logo (lucide icon or uploaded image), page name,
  subtitle.
- **Welcome page** — shown after successful verification: custom title, badge,
  Markdown body (with auto-linkified URLs/emails), and a welcome image with
  optional watermarking (visitor name/email overlay for tracking forwards).
- **Two verification modes** — freshman verification (name + ID) and email
  verification (sends the welcome page content to a `@nottingham.edu.cn` address).

### Real-time admission verification

- Queries the **live UNNC admission portal** server-side (no CORS, no client
  exposure).
- **Automatic slider-captcha solver** — a TypeScript port of the Python original,
  using NCC/template-matching to rank captcha offsets.
- **Trust bypass** — once a student verifies on one page, they're trusted across
  all pages (cookie-based, name+ID verified).
- **Mock mode** — for UI testing without hitting the portal.

### Analytics dashboard

- **Per-page statistics** — page views, unique visitors, verification outcomes
  (admitted / not found / error), and visitor profiles (locale, device, browser,
  OS, referer).
- **Cross-page overview** — aggregate KPIs, trend charts, per-page sparklines on
  the main dashboard.
- **Privacy-preserving** — ID numbers and IPs stored only as salted SHA-256
  hashes, never plaintext. Region inferred from Accept-Language (no GeoIP).
- **Admin dashboard** — superadmins see site-wide analytics across every page,
  grouped by owner.

### Page sharing & collaboration

- **Role-based access** — owner → manager → editor → viewer, with GitHub-style
  email invitations.
- **Invite links** — recipients get a personalized invitation email; they must
  sign in with the invited email to accept.
- **Transfer ownership** — the owner can hand off the page to another member.
- **Self-leave** — members can leave a page they no longer want to be part of.

### Email system

- **Per-page customizable email text** — every email's subject, body, button
  label, and footer can be customized in both languages. Tokens like `{org}`,
  `{role}`, `{date}`, `{n}` are auto-replaced.
- **Verification codes** — email verification on registration (6-digit code,
  scoped to a client session, rate-limited).
- **Invitations** — sent when a page manager invites a new member.
- **QR-expiry reminders** — automatic emails before a shared QR code expires
  (configurable: 3/2/1 days before and/or day-of, at a custom time).
- **Welcome content** — visitors can request the welcome page content emailed to
  their `@nottingham.edu.cn` address.
- **Dual mail provider** — SMTP or POST webhook (Custom Example / smtogo).
- **Rate limiting** — per-recipient (1/min, 10/day) and per-account (6/min,
  24/day) with near-limit warnings.
- **Disclaimer hiding** — outgoing emails use a text-color-matches-background
  trick to hide disclaimers appended by the mail relay.

### QR-code expiry detection

- **Automatic OCR** — when a page uploads a QR poster as their welcome image,
  tesseract.js (offline, local traineddata) scans the bottom footer for expiry
  dates in both Chinese ("7月30日前") and English ("Valid until 7/29").
- **Smart parsing** — interprets relative ("7天内"), absolute, and English
  formats; infers the year for short dates.
- **Per-user reminders** — every member picks their own schedule (3/2/1 days
  before and/or day-of, custom time, own timezone; default 2 days/1 day/day-of
  at 12:00 server time) from their Notifications tab or account Settings.

### Authentication & security

- **Email verification on registration** — 6-digit code sent to the registrant's
  email, scoped to a browser session.
- **Passkey / WebAuthn login** — passwordless sign-in via Face ID, Touch ID, or
  security keys.
- **Registration whitelist** — superadmin-controlled email-domain filter
  (e.g., `*@nottingham.edu.cn`).
- **Student/staff blocking** — institutional mailing-list addresses
  (containing "student" or "staff") are blocked from registration and
  welcome-content emails.
- **Rate limiting** — verification codes, invitations, welcome emails, and
  reminders all have per-target and per-account limits.

### Admin panel

- **User management** — view all users, change roles, delete accounts.
- **All Pages** — site-wide page list grouped by owner, with analytics
  overview.
- **Mail configuration** — SMTP/POST webhook setup with test email.
- **Registration whitelist** — glob-pattern email-domain filter.

---

## Quick start

```bash
pnpm install          # installs deps + runs nuxt prepare
pnpm dev              # http://localhost:3000
```

Database schema is managed by **TypeORM migrations** — pending ones apply
automatically on every boot (dev and production alike), so a freshly generated
migration takes effect on the next start. Entity changes should ship with a
generated migration (`pnpm migration:generate --name=<Name>`; enforced at
commit time). The first user to register becomes the **superadmin**.

> **Node ≥ 24** is required.

---

## Deployment

```bash
# Set required env vars
export SESSION_SECRET="your-secret-here"
export DB_PATH="./data/app.db"

# Build & run via Docker
docker compose up --build -d
```

The Docker image (`node:24-slim`) bundles the app, OCR traineddata, and fonts
for image processing. Mount a persistent volume at `/app/data` for the SQLite
database. Pending migrations apply automatically on container start — back up
the DB file before deploying a migration that renames or drops anything.

Optional env vars: `SITE_URL` (for email links), `TZ` (timezone, via host
`/etc/localtime` mount).

---

## Documentation

| Document                                               | Description                                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**       | Tech stack, system design, database schema, auth model, verification pipeline, API reference, project structure |
| **[docs/DATABASE-NAMING.md](docs/DATABASE-NAMING.md)** | Why the DB keeps `org_*` table names while code says "page", the entity↔table mapping, and the rename playbook  |

---

## License

[Apache-2.0](./LICENSE) · © [Robert He](https://github.com/hnrobert) @ [Computer Psycho Union](https://github.com/CompPsyUnion) · Built for the [UNNC](https://www.nottingham.edu.cn) community.
