import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The SPA is shipped as a fully static site (no server runtime). `base` can be
// overridden for sub-path deploys, e.g. `base: '/freshmen/'`.
//
// The `/__portal` proxy lets the static SPA reach the admission portal from the
// developer's own machine during `vite dev` / `vite preview` — the browser calls
// same-origin `/__portal/...` (no CORS) and Vite forwards it server-side,
// relaying the PHP session cookie so the captcha flow holds together.
const portalProxy = {
  target: 'https://entry.nottingham.edu.cn',
  changeOrigin: true,
  cookieDomainRewrite: '',
  rewrite: (path: string) => path.replace(/^\/__portal/, ''),
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@config': fileURLToPath(new URL('./config', import.meta.url)),
    },
  },
  server: { proxy: { '/__portal': portalProxy } },
  preview: { proxy: { '/__portal': portalProxy } },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
  },
})

