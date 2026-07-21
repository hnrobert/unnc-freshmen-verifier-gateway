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

/** Build the dashboard breadcrumb trail from the current route (no data fetch). */
function buildTrail(route: RouteLocationNormalized): BreadcrumbItem[] {
  const path = route.path
  const dash: BreadcrumbItem = { label: 'Dashboard', to: '/dashboard' }
  const orgs: BreadcrumbItem = { label: 'Organizations', to: '/dashboard/orgs' }

  if (path === '/dashboard') return [{ label: 'Dashboard' }]
  if (path === '/dashboard/orgs') return [dash, { label: 'Organizations' }]
  if (path === '/dashboard/new') return [dash, orgs, { label: 'New organization' }]
  if (path === '/dashboard/settings') return [dash, { label: 'Settings' }]

  // Admin section (superadmin): /dashboard/admin is the index; users /
  // registration / mail are sub-pages. (The section used to be a single page
  // with a ?tab= query — now it's a route dir, so match the sub-routes.)
  if (path === '/dashboard/admin') return [dash, { label: 'Admin' }]
  const adminPage = path.match(/^\/dashboard\/admin\/(users|registration|mail)$/)
  if (adminPage && adminPage[1]) {
    const label = ADMIN_TAB_LABELS[adminPage[1]] ?? adminPage[1]
    return [dash, { label: 'Admin', to: '/dashboard/admin' }, { label }]
  }

  // /dashboard/<slug>/{edit,advanced,members,share,preview} — breadcrumb stops at the
  // org slug; the sub-tab name isn't shown (the tabs are right there).
  const m = path.match(/^\/dashboard\/([^/]+)\/(edit|advanced|members|share|preview)$/)
  if (m && m[1]) {
    return [dash, orgs, { label: m[1] }]
  }

  // /dashboard/<slug> (Home — the org's data/stats panel)
  const home = path.match(/^\/dashboard\/([^/]+)$/)
  if (home && home[1]) {
    return [dash, orgs, { label: home[1] }]
  }

  // Fallback for anything else under /dashboard
  return [dash]
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
