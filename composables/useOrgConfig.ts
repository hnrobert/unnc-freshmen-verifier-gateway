import type { InjectionKey, Ref } from 'vue'
import type { SiteConfig } from '#shared/types'

/** Provided by the org layout (public pages) or the LivePreview (editor). */
export const OrgConfigKey: InjectionKey<{ config: Ref<SiteConfig> }> = Symbol('orgConfig')

/** Read the active org config (provided by an ancestor). Throws if missing. */
export function useOrgConfig() {
  const ctx = inject(OrgConfigKey)
  if (!ctx) throw new Error('useOrgConfig: no org config provided')
  return ctx
}
