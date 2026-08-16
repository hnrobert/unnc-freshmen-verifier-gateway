import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

// The HTML email template is authored as a standalone file (email/template.html).
// Read at config-eval time and passed to the server via runtimeConfig so it's
// bundled into the build reliably. (Nitro serverAssets didn't bundle it here.)
// Edits to the template require a dev-server restart to take effect.
const emailTemplate = readFileSync(
  fileURLToPath(new URL('./email/template.html', import.meta.url)),
  'utf-8',
)
const emailLogo = `data:image/svg+xml;base64,${Buffer.from(
  readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url))),
).toString('base64')}`

// Nuxt 4 full-stack config. The public per-page gateway is SSR-rendered so each
// page's config/i18n/theme apply on first paint; auth + pages + admission run as
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

  // vue-sonner: registers the client-only <Toaster> component, auto-adds its
  // CSS, and provides $toast. The preset below also auto-imports the `toast`
  // function so any <script setup> can call toast.error/.success directly.
  modules: ['vue-sonner/nuxt'],
  imports: {
    presets: [{ from: 'vue-sonner', imports: ['toast'] }],
  },

  // Tailwind v4 + shadcn theme CSS.
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle the common client deps Vite would otherwise discover at
    // runtime — each discovery forces a full page reload. email-poster is the
    // opposite case: its ./vue entry is raw .vue source, which esbuild can't
    // pre-bundle, so it's excluded and left to the Vue plugin to transform.
    optimizeDeps: {
      include: [
        '@lucide/vue',
        '@simplewebauthn/browser',
        '@vueuse/core',
        'chart.js',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'vue-chartjs',
        'vue-i18n',
      ],
      exclude: ['email-poster'],
    },
  },

  // Auto-import components by filename (no path prefix) so shadcn-vue <Button>,
  // <Card>, … and public <Icon> resolve without explicit imports. Only scan .vue
  // (the ui/ `index.ts` barrels are modules, not components).
  components: [{ path: '~/components', pathPrefix: false, extensions: ['.vue'] }],

  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    dbPath: process.env.DB_PATH || './data/app.db',
    // Cold-start seed only: the canonical public origin for background-email
    // links is normally inferred from observed visitor traffic
    // (server/utils/siteOrigin.ts). SITE_URL is used just until enough traffic
    // has been tallied, then ignored.
    siteUrl: process.env.SITE_URL || '',
    emailTemplate,
    emailLogo,
  },

  // No-FOUC dark mode: apply the saved/system theme synchronously in <head>
  // before first paint (matches @vueuse useColorMode's vg.theme key + logic).
  app: {
    head: {
      // Default favicon for non-page pages (homepage, auth, dashboard). Page
      // pages override this same key in layouts/default.vue with the page's
      // brand icon.
      link: [{ key: 'favicon', rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
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

  // Clone the page dashboard route subtree under the admin path so a superadmin
  // can open any page at /dashboard/admin/pages/<slug> with the FULL page
  // dashboard (same components — no page duplication). Each cloned route also
  // gets the 'superadmin' middleware so only superadmins can use the admin URL.
  hooks: {
    'pages:extend'(routes) {
      // Source: the /dashboard/:slug page subtree. Nuxt renders the param as
      // ':slug()' (not ':slug'), so match by prefix and rebuild the admin path
      // by swapping the '/dashboard' prefix → '/dashboard/admin/pages'.
      const src = routes.find((r) => r.path.startsWith('/dashboard/:slug'))
      if (!src) return
      const adminPath = `/dashboard/admin/pages${src.path.replace(/^\/dashboard/, '')}`
      const clone = (node: typeof src, pathOverride?: string): typeof src => {
        const meta = (node.meta ?? {}) as Record<string, unknown> & {
          middleware?: string[] | string
        }
        const mw = meta.middleware
        const arr = Array.isArray(mw) ? mw : mw ? [mw] : []
        return {
          ...node,
          path: pathOverride ?? node.path,
          name: node.name ? `${node.name}__admin` : undefined,
          meta: { ...meta, middleware: arr.includes('superadmin') ? arr : [...arr, 'superadmin'] },
          children: node.children ? node.children.map((c) => clone(c)) : node.children,
        }
      }
      routes.push(clone(src, adminPath))
    },
  },
})
