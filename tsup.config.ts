import { defineConfig } from 'tsup'

// Bundles the config CLI (`src/cli/index.ts`) into a single distributable file
// so the package can be installed and driven via the `unnc-vg` bin. In dev the
// CLI is run directly through `tsx` — this build is for consumers.
export default defineConfig({
  entry: ['src/cli/index.ts'],
  outDir: 'dist-cli',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: false,
  clean: true,
  minify: false,
  // lucide-vue-next is dynamically imported only to validate icon names at gen
  // time — keep it external so it resolves from the caller's node_modules.
  external: ['lucide-vue-next'],
  // The shebang lives in the source file (src/cli/index.ts); esbuild preserves
  // it, so no banner is needed (adding one duplicates it and breaks ESM parse).
})
