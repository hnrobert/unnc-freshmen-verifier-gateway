import type { RouteLocationNormalized } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  /** Internal route (rendered as NuxtLink). Omit for the current/last page. */
  to?: string
}

const ADMIN_TAB_LABELS: Record<string, string> = {
  users: 'Users',
  registration: 'Registration',
  mail: 'Mail',
}

/**
 * Build the dashboard breadcrumb trail from the current route (no data fetch).
 * The trail starts at the relevant section — no universal "Dashboard" prefix,
 * since every page already lives under the dashboard (the sidebar makes that
 * clear). So the page pages read "Pages › <slug>", not
 * "Dashboard › Pages › <slug>".
 */
function buildTrail(route: RouteLocationNormalized): BreadcrumbItem[] {
  const path = route.path
  const pages: BreadcrumbItem = { label: 'Pages', to: '/dashboard/pages' }

  if (path === '/dashboard') return [{ label: 'Dashboard' }]
  if (path === '/dashboard/pages') return [{ label: 'Pages' }]
  if (path === '/dashboard/new') return [pages, { label: 'New page' }]
  if (path === '/dashboard/settings') return [{ label: 'Settings' }]

  // Admin section (superadmin): /dashboard/admin is the index; users /
  // registration / mail are sub-pages. (The section used to be a single page
  // with a ?tab= query — now it's a route dir, so match the sub-routes.)
  if (path === '/dashboard/admin') return [{ label: 'Admin Dashboard' }]
  const adminPage = path.match(/^\/dashboard\/admin\/(users|registration|mail)$/)
  if (adminPage && adminPage[1]) {
    const label = ADMIN_TAB_LABELS[adminPage[1]] ?? adminPage[1]
    return [{ label: 'Admin Dashboard', to: '/dashboard/admin' }, { label }]
  }
  if (path === '/dashboard/admin/pages') {
    return [{ label: 'Admin Dashboard', to: '/dashboard/admin' }, { label: 'All Pages' }]
  }

  // Admin page view: /dashboard/admin/pages/<slug>(/<tab>) — same shape as the
  // personal pages trail ("Pages › <slug>"), but rooted at All Pages.
  const adminPageView = path.match(
    /^\/dashboard\/admin\/pages\/([^/]+)(?:\/(edit|advanced|members|share|preview|notifications))?$/,
  )
  if (adminPageView && adminPageView[1]) {
    return [{ label: 'All Pages', to: '/dashboard/admin/pages' }, { label: adminPageView[1] }]
  }

  // /dashboard/<slug>/{edit,advanced,members,share,preview,notifications} — breadcrumb stops at the
  // page slug; the sub-tab name isn't shown (the tabs are right there).
  const m = path.match(
    /^\/dashboard\/([^/]+)\/(edit|advanced|members|share|preview|notifications)$/,
  )
  if (m && m[1]) {
    return [pages, { label: m[1] }]
  }

  // /dashboard/<slug> (Home — the page's data/stats panel)
  const home = path.match(/^\/dashboard\/([^/]+)$/)
  if (home && home[1]) {
    return [pages, { label: home[1] }]
  }

  // Fallback for anything else under /dashboard
  return [{ label: 'Dashboard' }]
}

/**
 * Dashboard breadcrumb trail, derived from the route so it renders correctly
 * during SSR (no dependency on page setup order) and covers every dashboard
 * page without per-page code.
 */
export function useBreadcrumbs() {
  const route = useRoute()
  return computed<BreadcrumbItem[]>(() => buildTrail(route))
}
