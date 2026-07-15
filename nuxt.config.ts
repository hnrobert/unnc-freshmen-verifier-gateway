import tailwindcss from '@tailwindcss/vite'

// Nuxt 4 full-stack config. The public per-org gateway is SSR-rendered so each
// org's config/i18n/theme apply on first paint; auth + orgs + admission run as
// Nitro server routes (no CORS — the portal is called server-side).
//
// `shared/` is Nuxt 4's app↔server dir, auto-aliased to `#shared` (used by the
// app). Server files import shared code via relative paths (the built-in #shared
// alias isn't always in the server tsconfig).
export default defineNuxtConfig({
  compatibilityDate: '2026-07-13',
  devtools: { enabled: true },
  ssr: true,
  // Flat (Nuxt 3-style) layout: pages/components/layouts/… live at the project
  // root alongside app.vue, not under an app/ dir.
  srcDir: '.',

  // Tailwind v4 + shadcn theme CSS.
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  // Auto-import components by filename (no path prefix) so shadcn-vue <Button>,
  // <Card>, … and public <Icon> resolve without explicit imports. Only scan .vue
  // (the ui/ `index.ts` barrels are modules, not components).
  components: [{ path: '~/components', pathPrefix: false, extensions: ['.vue'] }],

  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    dbPath: process.env.DB_PATH || './data/app.db',
  },

  // No-FOUC dark mode: apply the saved/system theme synchronously in <head>
  // before first paint (matches @vueuse useColorMode's vg.theme key + logic).
  app: {
    head: {
      script: [
        {
          tagPosition: 'head',
          innerHTML:
            "(function(){try{var s=localStorage.getItem('vg.theme');" +
            "var d=s==='dark'||((s==='auto'||!s)&&matchMedia('(prefers-color-scheme: dark)').matches);" +
            'if(d)document.documentElement.classList.add("dark");}catch(e){}})();',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },

  // TypeORM decorator support for the Nitro server (esbuild tsconfigRaw).
  nitro: {
    esbuild: {
      options: {
        tsconfigRaw: JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        }),
      },
    },
  },

  future: {
    compatibilityVersion: 4,
  },
})
