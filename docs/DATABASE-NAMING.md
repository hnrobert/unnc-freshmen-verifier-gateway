# Database naming: `org_*` (deliberate) vs code naming: `Page`

> Status quo since the 2026-08 rename: **all code-level vocabulary was renamed
> from "organization/org" to "page"** (entities, classes, functions, API routes
> `/api/orgs/**` → `/api/pages/**`, frontend routes, composables, components).
> **The database was intentionally NOT renamed.** This document records that
> decision, the exact mapping, and the playbook if a full DB rename is ever
> wanted.

## Why the DB keeps `org_*`

`server/utils/database.ts` runs TypeORM with `synchronize: true`. That mode
aligns the schema to entity metadata by _structure only_ — it has no concept of
"rename". If an entity's `@Entity({ name })` were changed while the old table
still existed, the next boot would execute:

```
DROP TABLE organizations;      -- not in metadata anymore → dropped, data gone
CREATE TABLE pages (...);      -- new entity → created, empty
```

i.e. **total data loss** across every `org_*` table. Keeping the physical names
and mapping them through decorators is a zero-migration, zero-disk-change
rename: `synchronize` compares against the unchanged table names and is a no-op.

## Entity ↔ table mapping

Code says `Page*` / `pageId`; SQL keeps `org_*`. The mapping lives entirely in
the `@Entity` / `@Column({ name })` / `@Index(name)` decorators.

| Entity (code)              | File                                 | Table (DB)                    | Key column (DB → property) |
| -------------------------- | ------------------------------------ | ----------------------------- | -------------------------- |
| `Page`                     | `page.entity.ts`                     | `organizations`               | —                          |
| `PageSetting`              | `pageSetting.entity.ts`              | `org_settings`                | `org_id` → `pageId`        |
| `PageImage`                | `pageImage.entity.ts`                | `org_images`                  | `org_id` → `pageId`        |
| `PageMember`               | `pageMember.entity.ts`               | `org_members`                 | `org_id` → `pageId`        |
| `PageEvent`                | `pageEvent.entity.ts`                | `org_events`                  | `org_id` → `pageId`        |
| `PageDailyStat`            | `pageDailyStat.entity.ts`            | `org_daily_stats`             | `org_id` → `pageId`        |
| `PageReminderSent`         | `pageReminderSent.entity.ts`         | `org_reminder_sents`          | `org_id` → `pageId`        |
| `PageRedirect`             | `pageRedirect.entity.ts`             | `org_redirects`               | `org_id` → `pageId`        |
| `PageVerifiedIdentity`     | `pageVerifiedIdentity.entity.ts`     | `org_verified_identities`     | `org_id` → `pageId`        |
| `UserPageNotificationPref` | `userPageNotificationPref.entity.ts` | `user_org_notification_prefs` | `org_id` → `pageId`        |

Constraint/index names (`uq_organizations_slug`, `pk_org_settings`,
`uq_org_images_org_key`, …) also keep their original spelling — they are part of
the physical schema.

## Persisted strings that also keep `org` (do NOT rename casually)

These live in stored data, not code, so renaming the code side alone would
orphan them:

- **`app_settings` key `limits.adminOrgLimit`** — the superadmin-configurable
  default page limit (`server/utils/limits.ts` `SETTING_KEY`). Renaming the key
  string silently resets every deployment's configured limit to the default.
- **Email placeholder `{org}`** — `tpl()` in `server/utils/emailText.ts`
  substitutes `{org}` from the `org:` argument in `members.post.ts` /
  `reminders.ts`. Every already-saved org config's custom email copy
  (`messages.{zh,en}.email.*`) may contain `{org}`; changing the token breaks
  those templates silently. `{org}` is therefore a permanent placeholder name.
- **`users.org_limit` column** — mapped to the `User.pageLimit` property via
  `@Column({ name: 'org_limit' })`.

Unrelated and intentionally untouched: `SITE_ORG_NAME` / `SITE_ORG_URL` in
`shared/lib/site.ts` refer to the _maintaining GitHub organization_, not this
concept.

## Playbook: renaming the DB too (if ever wanted)

Do **not** simply change the decorator names — see the data-loss note above.
The safe sequence:

1. **Back up the file**: `cp data/app.db data/app.db.bak-$(date +%F)`.
2. Write a one-shot migration that runs **before** `AppDataSource.initialize()`
   (synchronize executes inside `initialize()`), using better-sqlite3 directly,
   gated by an `app_settings` flag so it runs exactly once — same pattern as
   `server/plugins/03.reminders-migration.ts`, but hoisted ahead of DB init
   (e.g. at the top of `01.db.ts`):
   ```sql
   ALTER TABLE organizations        RENAME TO pages;
   ALTER TABLE org_settings         RENAME TO page_settings;
   ALTER TABLE org_images           RENAME TO page_images;
   ALTER TABLE org_members          RENAME TO page_members;
   ALTER TABLE org_events           RENAME TO page_events;
   ALTER TABLE org_daily_stats      RENAME TO page_daily_stats;
   ALTER TABLE org_reminder_sents   RENAME TO page_reminder_sents;
   ALTER TABLE org_redirects        RENAME TO page_redirects;
   ALTER TABLE org_verified_identities RENAME TO page_verified_identities;
   ALTER TABLE user_org_notification_prefs RENAME TO user_page_notification_prefs;
   -- per renamed table:
   ALTER TABLE page_settings RENAME COLUMN org_id TO page_id;  -- (repeat)
   ```
   SQLite ≥ 3.25 supports both forms (bundled better-sqlite3 is far newer). This
   schema has **no FK constraints** (bare integer columns, no TypeORM
   relations), so no reference rewriting is needed.
3. Migrate persisted strings in the same pass:
   `UPDATE app_settings SET key='limits.adminPageLimit' WHERE key='limits.adminOrgLimit';`
   and decide a policy for `{org}` in stored email copy (simplest: keep
   substituting `{org}` forever).
4. Update the decorators (`@Entity({ name: 'pages' })`,
   `@Column({ name: 'page_id' })`, index/constraint names) and drop/recreate
   the named indexes to match.
5. Deploy once; `synchronize` then sees matching tables and does nothing.

Until then: leave the DB alone; the decorator mapping above is the contract.
