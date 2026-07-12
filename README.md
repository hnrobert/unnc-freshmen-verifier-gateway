# UNNC Freshmen Verifier Gateway

A **static, fully-customizable, bilingual (中文 / English)** verify-gateway for UNNC
freshmen. Visitors enter a **name + ID number**; once verified they see a welcome
page with your custom image, title and **Markdown** body (bare URLs and emails are
auto-linked). No server required — deploy the built `dist/` to any static host.

It is the static reimagining of the Python/Flask checker in [`ref/`](./ref): where
that tool solves the official portal's slider captcha at runtime (impossible in a
static site), this gateway verifies against a **build-time hashed allow-list**
generated from your own student roster.

---

## Tech stack

TypeScript · Node 24 · Vue 3 · Vite · vue-router · vue-i18n · Tailwind CSS v4 +
[shadcn-vue](https://shadcn-vue.com) · lucide-vue-next · markdown-it · tsup (CLI) · pnpm

---

## Quick start

```bash
pnpm install      # also runs `gen` (postinstall) to create the bundled allow-list
pnpm dev          # dev server at http://localhost:5173
pnpm build        # production static site -> dist/
pnpm preview      # preview the built site
```

`pnpm install` runs `gen` automatically (postinstall), so a fresh clone works out
of the box using the example data. Deploy the contents of `dist/` anywhere
(GitHub Pages, Netlify, Vercel, Nginx, …). Hash routing is used, so no server
rewrites are needed.

### Try the demo

The repo ships `config/students.example.csv`. With it, these verify successfully:

| 姓名 / Name | 身份证号 / ID Number |
| --- | --- |
| 张三 | `110101200001011234` |
| 李四 | `32058320000719567X` |
| Li Si | `44030120051109203X` |

---

## How verification works

1. You list verifiable people in `config/students.csv` (`name,id_number`).
2. `pnpm gen` hashes each `name|id` pair with your `salt` (SHA-256) and writes a
   list of **hashes** to `src/generated/verifiers.json`. Raw names/IDs are **never**
   shipped to the browser.
3. On submit, the SPA hashes the visitor's input the same way and checks membership
   in that list. A match unlocks the welcome page for the session.

> **Security note.** This is a *UX gate*, not an access-control boundary — the
> welcome content lives in the static bundle and can be read by anyone inspecting
> it. The hashed allow-list prevents casual exposure of the roster and resists
> trivial lookup, but a determined attacker could brute-force IDs. Choose a unique
> `salt` per deployment and don't rely on this for anything sensitive.

---

## Customizing everything

All customization happens in **`config/site.config.ts`** (type-checked, with full
autocomplete) and **`config/students.csv`**. After editing, re-run `pnpm gen`
(regenerates the allow-list **and** the icon registry) and `pnpm build`.

### Labels & content (bilingual)

Every label and the welcome title/body live under `messages.zh` / `messages.en`.
These are fed straight into `vue-i18n`, so the keys (e.g. `verify.nameLabel`,
`welcome.body`) are exactly what the templates render via `t('...')`. Add any keys
you reference.

```ts
messages: {
  zh: {
    verify: { nameLabel: '姓名', idPlaceholder: '18 位身份证号（末位可为 X）', submit: '立即核验' },
    welcome: {
      title: '欢迎加入 UNNC！',
      // Full Markdown. Bare URLs / emails are auto-linked.
      body: '# 欢迎\n加入迎新群：freshmen@unnc.example',
    },
  },
  en: { /* …mirror the same keys… */ },
}
```

### Icons (every page)

Set any `lucide-vue-next` icon by name, or use a custom image (e.g. a school crest):

```ts
icons: {
  brand: 'GraduationCap',          // any lucide name: https://lucide.dev/icons
  nameField: 'User',
  submit: 'ArrowRight',
  // …or a custom image:
  // brand: { img: '/crest.png' },
}
```

Only the icons referenced in config are bundled (`gen` generates a tiny registry),
so the bundle stays small. Unknown names fall back to `CircleHelp` with a warning.

### Welcome page assets

```ts
welcome: {
  image: './welcome.svg',     // public path or remote URL; omit for no image
  imageMaxWidth: '12rem',
  imageRounded: true,         // circular crop
}
```

The welcome body is **Markdown** rendered with `markdown-it`. Bare URLs and emails
are detected automatically (TLD-agnostic — `.dev`, `.app`, `.edu.cn`, …) and open
in a new tab safely. Code spans, fenced code, and existing links are left alone.

### Theme & branding

- `theme.radius` sets the global border-radius.
- Colors are CSS variables in `src/style.css` (`:root` / `.dark`) — edit them to
  rebrand. Dark/light/system toggle is built in (persisted per visitor).

### Salt

```ts
salt: 'change-me-for-your-deployment'
```

Change this so your bundled hashes aren't reusable elsewhere. **Must match** between
`gen` and the SPA (both read this same file).

### Students roster

Copy the example and fill in real records:

```bash
cp config/students.example.csv config/students.csv
# edit config/students.csv  (gitignored — sensitive)
pnpm gen && pnpm build
```

```csv
name,id_number
张三,110101200001011234
李四,32058320000719567X
```

`gen` tolerates header names like `name/姓名` and `id_number/id/身份证号`, normalizes
whitespace/case, and skips invalid rows with a warning.

### Adding a locale

1. Add the code to `locales` (e.g. `'ja'`) and a `messages.ja` block.
2. Update `Locale` in `src/shared/types.ts`.
3. `pnpm gen && pnpm build`.

---

## CLI (`unnc-vg`)

The config helper is also a bundled CLI (`pnpm build:cli` → `dist-cli/index.js`):

```bash
pnpm cli gen        # regenerate verifiers.json + icon registry from students + config
pnpm cli validate   # check site.config.ts for missing locales/keys/salt
pnpm cli help
```

`validate` confirms every required message key exists for every locale and that the
salt is set.

---

## Project structure

```
config/
  site.config.ts          # ← edit this: labels, icons, welcome content, salt, theme
  students.example.csv    # roster format; copy to students.csv (gitignored)
src/
  cli/index.ts            # tsup-bundled CLI: gen + validate
  shared/                 # types + hashing (shared by CLI and SPA)
  lib/                    # verify, markdown (autolink), icon resolver, cn()
  i18n/                   # vue-i18n from config.messages
  components/ui/          # shadcn-vue: button, input, label, card
  components/             # Icon, MarkdownView, toggles, BrandMark, StatusAlert
  pages/                  # VerifyPage.vue, WelcomePage.vue
  layouts/                # DefaultLayout.vue
  generated/              # gitignored build output (verifiers.json, icons.ts)
```

Add more shadcn-vue components anytime: `npx shadcn-vue@latest add <component>`
(requires `reka-ui`, installed automatically by the CLI when needed).

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | `gen` + Vite dev server |
| `pnpm build` | `gen` + static production build to `dist/` |
| `pnpm preview` | Preview the built site |
| `pnpm gen` | Regenerate allow-list + icon registry |
| `pnpm validate` | Validate `site.config.ts` |
| `pnpm build:cli` | Bundle the CLI with tsup (`dist-cli/index.js`) |
| `pnpm typecheck` | `vue-tsc --noEmit` |

---

## Notes

- The browser language is auto-detected on first visit; the chosen language and
  theme are persisted. `defaultLocale` is the fallback.
- Verification state is kept in `sessionStorage`, so a verified visitor stays on
  the welcome page across reloads in the same tab but re-verifies after closing it.
- For legal/ethical use only. ID numbers are sensitive personal data — handle the
  roster with care and don't expose it publicly.
