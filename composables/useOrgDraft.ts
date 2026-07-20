import type { Ref } from 'vue'
import type { SiteConfig } from '#shared/types'
import { OrgConfigKey } from './useOrgConfig'

/**
 * Build an editable draft from an already-loaded org config, provide it to the
 * ConfigEditor (via OrgConfigKey), and expose save/discard/dirty/leave-guard.
 *
 * SYNC by design: the `await useFetch/useAsyncData` for `raw` + `access` happen
 * at the PAGE level (context-safe via Suspense). Doing them inside an async
 * composable lost the Nuxt instance after the await ("[nuxt] instance
 * unavailable"), so the pages fetch, then hand the results here.
 */
export function useOrgDraft(raw: SiteConfig, access: Ref<{ role: string | null } | undefined>) {
  const route = useRoute()
  const slug = computed(() => route.params.slug as string)

  const draft = ref(JSON.parse(JSON.stringify(raw))) as Ref<SiteConfig>
  const wAny = draft.value.welcome as Record<string, unknown>
  if (wAny.imageRounded !== undefined && wAny.imageRadius === undefined) {
    wAny.imageRadius = wAny.imageRounded ? '50%' : '0.5rem'
    delete wAny.imageRounded
  }
  if (!wAny.imageRadius) wAny.imageRadius = '0.5rem'
  if (!draft.value.background) draft.value.background = { overlayOpacity: 0.5 }
  provide(OrgConfigKey, { config: draft })

  const { applyOrgI18n, mergeOrgMessages } = useOrgI18n()
  const acceptLanguage = import.meta.server
    ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
    : typeof navigator !== 'undefined'
      ? navigator.language
      : ''
  applyOrgI18n(draft.value, acceptLanguage)
  watch(
    () => draft.value.messages,
    () => mergeOrgMessages(draft.value),
    { deep: true },
  )

  const canEdit = computed(() =>
    ['owner', 'manager', 'editor', 'superadmin'].includes(access.value?.role ?? ''),
  )
  const saving = ref(false)
  const saved = ref(false)
  const originalSerialized = ref(JSON.stringify(raw))
  const isDirty = computed(() => JSON.stringify(draft.value) !== originalSerialized.value)
  const { confirmLeave, proceed } = useUnsavedLeaveGuard(isDirty, saving)

  async function onSave(): Promise<boolean> {
    saving.value = true
    saved.value = false
    try {
      const v = await $fetch<{ errors: string[] }>('/api/orgs/validate', {
        method: 'POST',
        body: { config: draft.value },
      })
      if (v.errors.length) {
        toast.error(v.errors.join('; '))
        return false
      }
      await $fetch(`/api/orgs/${slug.value}/config`, {
        method: 'PUT',
        body: { config: draft.value },
      })
      originalSerialized.value = JSON.stringify(draft.value)
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
      return true
    } catch (e) {
      toast.error(messageFromError(e, 'Save failed'))
      return false
    } finally {
      saving.value = false
    }
  }

  function onDiscard(): void {
    draft.value = JSON.parse(JSON.stringify(raw))
    originalSerialized.value = JSON.stringify(raw)
  }

  return { slug, isDirty, canEdit, saving, saved, confirmLeave, proceed, onSave, onDiscard }
}
