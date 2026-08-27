/**
 * Vue compile-time flags for code that ships as a Nitro EXTERNAL.
 *
 * vue-i18n (and some other Vue-ecosystem prod builds) read bare identifiers
 * like `__VUE_PROD_DEVTOOLS__`. The `define` in nuxt.config's nitro.esbuild
 * options only rewrites code that goes through the bundler — externals under
 * `.output/server/node_modules/` are copied verbatim, so the flag stays
 * undefined and every SSR request that installs vue-i18n dies with an
 * unhandled ReferenceError.
 *
 * Defining the flags on globalThis fixes that at runtime: a bare identifier
 * resolves through the scope chain down to the global object, bundled or not.
 * Runs as plugin `00-` so it precedes everything else at boot.
 */
const g = globalThis as unknown as Record<string, unknown>

if (g.__VUE_PROD_DEVTOOLS__ === undefined) g.__VUE_PROD_DEVTOOLS__ = false
if (g.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ === undefined) {
  g.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false
}

export default defineNitroPlugin(() => {
  // Flags are set at module scope above — nothing to do per-request.
})
