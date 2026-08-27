import type { SiteConfig } from '#shared/types'

/** Provided by the page layout (public pages: verify / welcome / preview). */
export const PageConfigKey: InjectionKey<{ config: Ref<SiteConfig> }> = Symbol('pageConfig')

/** Read the active page config (provided by an ancestor). Throws if missing. */
export function usePageConfig() {
  const ctx = inject(PageConfigKey)
  if (!ctx) throw new Error('usePageConfig: no page config provided')
  return ctx
}
