import { defineConfig } from 'tsup'

/**
 * Builds the Node CLI tooling (migration scripts + selftest) into plain ESM
 * bundles via tsup (esbuild) — the app itself stays on the Nuxt/Nitro pipeline.
 *
 * This replaces two earlier approaches, both with Node 24 problems:
 *  - tsx passes .ts through to native type stripping, which runs TypeORM's
 *    legacy decorators with stage-3 semantics (crash);
 *  - a hand-rolled esbuild module-hooks loader worked but transformed every
 *    file on each invocation.
 * Prebuilt bundles start instantly and need no loader.
 *
 * `experimentalDecorators` comes from the root tsconfig; `emitDecoratorMetadata`
 * is not needed — every entity column declares an explicit `type`.
 */
export default defineConfig({
  entry: [
    'scripts/migration-run.ts',
    'scripts/migration-revert.ts',
    'scripts/migration-generate.ts',
    'scripts/selftest.ts',
  ],
  outDir: 'scripts/dist',
  format: ['esm'],
  target: 'node24',
  splitting: true,
  // No emitDecoratorMetadata: every entity column declares an explicit type,
  // so tsup doesn't need its swc plugin for TypeORM metadata.
  tsconfig: 'tsup.tsconfig.json',
  clean: true,
  sourcemap: false,
  dts: false,
})
