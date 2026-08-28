import type { Ref } from 'vue'
import type { SiteConfig } from '#shared/types'
import { PageConfigKey } from './usePageConfig'

/**
 * Build an editable draft from an already-loaded page config, provide it to the
 * ConfigEditor (via PageConfigKey), and expose save/discard/dirty/leave-guard.
 *
 * SYNC by design: the `await useFetch/useAsyncData` for `raw` + `access` happen
 * at the PAGE level (context-safe via Suspense). Doing them inside an async
 * composable lost the Nuxt instance after the await ("[nuxt] instance
 * unavailable"), so the pages fetch, then hand the results here.
 */
export function usePageDraft(raw: SiteConfig, access: Ref<{ role: string | null } | undefined>) {
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
  provide(PageConfigKey, { config: draft })

  const { applyPageI18n, mergePageMessages } = usePageI18n()
  const acceptLanguage = import.meta.server
    ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
    : typeof navigator !== 'undefined'
      ? navigator.language
      : ''
  applyPageI18n(draft.value, acceptLanguage)
  watch(
    () => draft.value.messages,
    () => mergePageMessages(draft.value),
    { deep: true },
  )

  const canEdit = computed(() =>
    ['owner', 'manager', 'editor', 'superadmin'].includes(access.value?.role ?? ''),
  )
  const originalSerialized = ref(JSON.stringify(raw))
  const isDirty = computed(() => JSON.stringify(draft.value) !== originalSerialized.value)

  async function onSave(): Promise<boolean> {
    try {
      const v = await $fetch<{ errors: string[] }>('/api/pages/validate', {
        method: 'POST',
        body: { config: draft.value },
      })
      if (v.errors.length) {
        toast.error(v.errors.join('; '))
        return false
      }
      await $fetch(`/api/pages/${slug.value}/config`, {
        method: 'PUT',
        body: { config: draft.value },
      })
      originalSerialized.value = JSON.stringify(draft.value)
      return true
    } catch (e) {
      toast.error(messageFromError(e, 'Save failed'))
      return false
    }
  }

  function onDiscard(): void {
    draft.value = JSON.parse(JSON.stringify(raw))
    originalSerialized.value = JSON.stringify(raw)
  }

  // Saving/saved/leave-guard lifecycles live in GuardedSave, not here.
  return { slug, isDirty, canEdit, onSave, onDiscard }
}
