import { createRouter, createWebHashHistory } from 'vue-router'
import { useVerifier } from '@/composables/useVerifier'

// Hash history so the static build works on any host without server rewrites.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      name: 'verify',
      path: '/',
      component: () => import('@/pages/VerifyPage.vue'),
    },
    {
      name: 'welcome',
      path: '/welcome',
      component: () => import('@/pages/WelcomePage.vue'),
    },
  ],
})

// The welcome page is gated behind a passed verification for the current session.
router.beforeEach((to) => {
  const { isVerified } = useVerifier()
  if (to.name === 'welcome' && !isVerified.value) {
    return { name: 'verify' }
  }
  return true
})

export default router
