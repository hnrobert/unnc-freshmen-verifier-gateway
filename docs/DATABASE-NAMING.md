# Database naming: the `org_*` → `page_*` migration

> History: the 2026-08 code rename (organization → page) initially kept the
> physical `org_*` schema untouched, because at that time the project ran
> TypeORM with `synchronize: true` — which treats a table rename as
> DROP + CREATE (total data loss). The migration system introduced afterwards
> (see [server/migrations/README.md](../server/migrations/README.md)) made the
> rename safe: migration **`1760000000001-OrgToPageRename`** performs it with
> `ALTER TABLE … RENAME`, preserving all data.

## What the rename migration does

Every statement is existence-guarded (no-op on fresh databases created by
`Init` with `page_*` names already):

| Kind    | Change                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables  | `organizations`→`pages`, `org_settings`→`page_settings`, `org_images`→`page_images`, `org_members`→`page_members`, `org_events`→`page_events`, `org_daily_stats`→`page_daily_stats`, `org_reminder_sents`→`page_reminder_sents`, `org_redirects`→`page_redirects`, `org_verified_identities`→`page_verified_identities`, `user_org_notification_prefs`→`user_page_notification_prefs` |
| Columns | `org_id`→`page_id` on all 10 child tables (incl. `audit_events`); `users.org_limit`→`page_limit`                                                                                                                                                                                                                                                                                      |
| Data    | `app_settings` key `limits.adminOrgLimit` → `limits.adminPageLimit`                                                                                                                                                                                                                                                                                                                   |

## What deliberately still says `org` (do NOT "fix" casually)

- **Index / constraint names** — `uq_organizations_slug`, `pk_org_settings`,
  `uq_org_images_org_key`, `idx_org_events_org_time`, … SQLite cannot rename an
  index (only drop/recreate), they are labels rather than identifiers, and both
  fresh (`Init`) and migrated databases share the same spelling. Leave them.
- **Email placeholder `{org}`** — `tpl()` in `server/utils/emailText.ts`
  substitutes `{org}` from the `org:` argument in `members.post.ts` /
  `reminders.ts`. Saved page configs may customize email copy with `{org}` in
  it; changing the token would silently break those. `{org}` is permanent.
- **`SITE_ORG_NAME` / `SITE_ORG_URL`** (`shared/lib/site.ts`) — the maintaining
  GitHub organization. Unrelated concept.

## Existing databases & the journal bootstrap

Pre-migration databases carry (a) the full v1 `org_*` schema and (b) a stale
`migrations` journal from the abandoned first migration system. The journal
bootstrap in `server/utils/database.ts` (`bootstrapMigrationJournal`) runs
before TypeORM initializes on every boot and:

1. drops the stale journal when it is recognized (by its known first row
   `Init1784089805639`),
2. marks the new baseline `Init1760000000000` as already applied when the v1
   `organizations` table is present — so such databases skip straight to the
   rename migration.

Fresh databases start with an empty journal and get the full `Init`. After the
first boot everything converges to the same state; subsequent boots are no-ops.

## Operational notes

- Back up before deploying a renaming migration:
  `cp data/app.db data/app.db.bak-$(date +%F)`.
- The rename is reversible: `pnpm migration:revert` runs its `down()`
  (verified round-trip on a database copy).
