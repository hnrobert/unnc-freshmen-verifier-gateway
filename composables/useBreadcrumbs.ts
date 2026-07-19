import type { RouteLocationNormalized } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  /** Internal route (rendered as NuxtLink). Omit for the current/last page. */
  to?: string
}

const ACTION_LABELS: Record<string, string> = {
  edit: 'Edit',
  members: 'Members',
  stats: 'Statistics',
}
const ADMIN_TAB_LABELS: Record<string, string> = {
  orgs: 'Organizations',
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

  if (path === '/dashboard/admin') {
    const tabLabel = ADMIN_TAB_LABELS[String(route.query.tab ?? 'orgs')]
    return tabLabel
      ? [dash, { label: 'Admin', to: '/dashboard/admin' }, { label: tabLabel }]
      : [dash, { label: 'Admin' }]
  }

  // /dashboard/<slug>/{edit,members,stats}
  const m = path.match(/^\/dashboard\/([^/]+)\/(edit|members|stats)$/)
  if (m && m[1] && m[2]) {
    const slug = m[1]
    const actionLabel = ACTION_LABELS[m[2]]
    if (actionLabel) {
      return [dash, orgs, { label: slug, to: `/dashboard/${slug}/edit` }, { label: actionLabel }]
    }
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
