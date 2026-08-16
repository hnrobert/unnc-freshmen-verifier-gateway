/**
 * Minimal esbuild-based TS loader for the migration CLI scripts.
 *
 * tsx passes .ts files through to Node 24's native type stripping, which runs
 * decorators with stage-3 semantics and crashes TypeORM's legacy decorators —
 * and native stripping can't emit the `design:*` metadata TypeORM columns rely
 * on either. esbuild handles both (`experimentalDecorators` +
 * `emitDecoratorMetadata`), so scripts run through this loader instead:
 *
 *   node --import ./scripts/lib/ts-loader.mjs scripts/migration-run.ts
 *
 * (`module.register` is soft-deprecated in favour of `registerHooks`, but the
 * sync variant has different resolve-hook semantics — keep this until that
 * settles.)
 */
import { register } from 'node:module'

register('./esbuild-hooks.mjs', import.meta.url)
