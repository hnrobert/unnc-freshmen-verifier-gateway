import { createI18n } from 'vue-i18n'

// Per-request vue-i18n instance (Nuxt plugins run per SSR request, so there is
// no cross-request leak). Org messages are merged in by `useOrgI18n` when the
// org layout loads its config.
export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'zh',
    fallbackLocale: 'zh',
    messages: {},
  })
  nuxtApp.vueApp.use(i18n)
})
