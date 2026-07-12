import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import siteConfig from '@config/site.config'
import './style.css'

// Apply the configured border radius so `theme.radius` in site.config.ts is live.
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--radius', siteConfig.theme.radius)
}

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')
