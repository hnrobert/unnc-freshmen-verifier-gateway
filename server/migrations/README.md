# Migrations

DO NOT EDIT OR DELETE FILES IN THIS FOLDER UNLESS YOU KNOW WHAT YOU ARE DOING.

The database schema is managed by TypeORM migrations (`synchronize` is OFF —
see `server/utils/database.ts`). On every boot the server **auto-applies
pending migrations** (dev and production alike), so after `pnpm
migration:generate` the change takes effect on the next start — no manual step.

## The first two migrations are special

- **`1760000000000-Init`** — baseline schema (all 16 tables, post-rename
  `page_*` spelling). Runs only on FRESH databases.
- **`1760000000001-OrgToPageRename`** — renames the physical `org_*` schema to
  `page_*` (tables, `org_id` → `page_id`, `users.org_limit` → `page_limit`, the
  `app_settings` limits key). Existence-guarded, so it is a no-op on fresh
  databases that never had `org_*` names.

Existing pre-migration databases are handled by the journal bootstrap in
`server/utils/database.ts` (`bootstrapMigrationJournal`): the stale journal
left by the abandoned first migration system is dropped, and `Init` is marked
as applied, so such databases go straight to the rename. Index/constraint
NAMES keep their legacy `org_*` spelling by design — see
[../../docs/DATABASE-NAMING.md](../../docs/DATABASE-NAMING.md).

## Workflow

```bash
# 1. Change entities in server/entities/…

# 2. Generate a migration (diffs entities against a database — bring your
#    dev DB to latest first, which the script does automatically):
pnpm migration:generate --name=AddUserAvatar

# 3. REGISTER the new class in index.ts (the barrel is what the server runs —
#    the commit hook rejects unregistered migration files).

# 4. Apply locally (same code path as server boot):
pnpm migration:run

# Made a mistake? Revert the last step (back up first — it is destructive):
pnpm migration:revert
```

Both scripts accept `--db=<path>` (default `DB_PATH` env or `./data/app.db`).

## Guards

- `.husky/commit-msg` runs `pnpm migration:check`: staging entity changes
  without a new, barrel-registered migration fails the commit. Bypass with
  `bypass migration check` in the commit message.
- Scripts run through `scripts/lib/ts-loader.mjs` (esbuild, legacy decorators +
  metadata). Do NOT switch them to tsx: under Node 24 tsx passes `.ts` through
  to native type stripping, which executes TypeORM's legacy decorators with
  stage-3 semantics and crashes.

## Rules

1. Never edit an already-committed migration — append a new one instead.
2. Every new file must be registered in `index.ts` in chronological order.
3. Destructive operations (drop/rename) must be guarded by existence checks
   when they might run against differently-shaped databases.
4. Back up the production database (`cp data/app.db data/app.db.bak-$(date +%F)`)
   before deploying a migration that renames or drops anything.
