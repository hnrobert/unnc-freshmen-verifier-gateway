/**
 * Migration barrel — the ordered list of migrations, imported explicitly (not
 * globbed) so the Nitro production bundle includes them and the server can
 * auto-apply pending migrations on boot. The `migration:*` CLI scripts reuse
 * this same list through `server/utils/database.ts`.
 *
 * The first entry is special: `BASELINE_MIGRATION` identifies it so the journal
 * bootstrap in `database.ts` can mark it as applied on pre-migration databases
 * (they already have the full v1 schema — only *newer* migrations should run).
 */
import { Init1760000000000 } from './1760000000000-Init'
import { OrgToPageRename1760000000001 } from './1760000000001-OrgToPageRename'

/** Identity of the first (baseline) migration. */
export const BASELINE_MIGRATION = {
  timestamp: 1760000000000,
  name: 'Init1760000000000',
} as const

// typeorm@1 typings expect `(string | Function)[]` for the DataSource option;
// migration classes satisfy that at runtime (classes are functions) but not
// structurally, hence the cast.
export const migrations = [Init1760000000000, OrgToPageRename1760000000001] as unknown as (
  string | Function
)[]
