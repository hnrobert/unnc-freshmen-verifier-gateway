<script setup lang="ts">
import { validateSlug } from '#shared/types'

// The "Name & URL" card — the last card on the Edit page. Edits the
// Page entity (name + slug) via PATCH /api/pages/:slug, which is a
// separate save path from the SiteConfig draft the rest of the editor uses
// (different table, owner-only permission, and a rename relocates the URL), so
// it keeps its OWN save logic — but surfaces it through the same shared
// SaveBar + UnsavedLeaveDialog affordance as everything else. Owner-only —
// which for the API means rank ≥ owner, so a SUPERADMIN opening someone else's
// page via the admin route has full control here too.
const props = defineProps<{ slug: string }>()
const router = useRouter()
const route = useRoute()

// Identity + role come from /access (works for every viewer including a superadmin
// on a page they don't own — the /api/pages list only covers owned/shared).
const { data: access, refresh: refreshAccess } = await useFetch<{
  role: string | null
  rank: number
  page: { slug: string; name: string }
}>(() => `/api/pages/${props.slug}/access`, { watch: [() => props.slug] })

// Shared page list (same key as the dashboard layout → stays in sync, and the
// tab bar / breadcrumb pick up the new slug after a rename).
const { refresh: refreshPages } = await useFetch<{
  pages: { slug: string; name: string; role: string }[]
}>('/api/pages', { default: () => ({ pages: [] }), key: 'pages-list' })

const page = computed(() => access.value?.page)
const canManage = computed(() => (access.value?.rank ?? 0) >= 4) // owner or superadmin

const nameDraft = ref('')
const slugDraft = ref('')
const confirmDraft = ref('')
// Mirrored from GuardedSave so the inputs can disable themselves mid-save.
const saving = ref(false)

// Fill the drafts once, when the page resolves — never again, so edits are never
// clobbered while typing. The parent remounts this card on slug change
// (:key="slug") so navigating to another page starts fresh.
let initialized = false
watch(
  page,
  (o) => {
    if (!initialized && o) {
      nameDraft.value = o.name
      slugDraft.value = o.slug
      initialized = true
    }
  },
  { immediate: true },
)

const normalSlug = computed(() => slugDraft.value.trim().toLowerCase())
const slugChanging = computed(() => normalSlug.value !== (page.value?.slug ?? ''))
const nameChanging = computed(() => nameDraft.value.trim() !== (page.value?.name ?? ''))
const dirty = computed(() => slugChanging.value || nameChanging.value)

const slugError = computed(() => (slugChanging.value ? validateSlug(normalSlug.value) : null))
const confirmed = computed(
  () => !slugChanging.value || confirmDraft.value.trim().toLowerCase() === normalSlug.value,
)
const canSave = computed(
  () => canManage.value && dirty.value && !slugError.value && confirmed.value && !saving.value,
)

// Leave-guard for the card's own draft (the page-level one covers the config
// draft; both may be dirty independently).
function reset() {
  if (!page.value) return
  nameDraft.value = page.value.name
  slugDraft.value = page.value.slug
  confirmDraft.value = ''
}

async function onSave(): Promise<boolean> {
  if (!canSave.value || !page.value) return false
  try {
    const res = await $fetch<{
      page: { id: number; slug: string; name: string }
      renamed: boolean
      oldSlug: string | null
    }>(`/api/pages/${props.slug}`, {
      method: 'PATCH',
      body: { name: nameDraft.value.trim(), slug: normalSlug.value },
    })
    toast.success(res.renamed ? 'Page renamed' : 'Page updated')
    confirmDraft.value = ''
    await refreshPages()
    if (res.renamed) {
      // The URL changed — relocate to the new slug's edit page, staying on the
      // admin route when the page was opened through it (a superadmin may not
      // have access to the personal URL of someone else's page).
      const base = route.path.startsWith('/dashboard/admin')
        ? `/dashboard/admin/pages/${res.page.slug}`
        : `/dashboard/${res.page.slug}`
      await router.replace(`${base}/edit`)
    }
    await refreshAccess()
    return true
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    return false
  }
}

// Surfaced to the parent (edit.vue) so the config editor's GuardedSave can
// hide while this card's bar is up — two fixed bottom bars must never stack.
defineExpose({ isDirty: dirty })
</script>

<template>
  <section v-if="page && canManage" class="space-y-4">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Name &amp; URL
    </h3>
    <form class="flex flex-col gap-5" @submit.prevent="onSave">
      <!-- Name -->
      <div class="flex flex-col gap-2">
        <Label for="page-name">Page name</Label>
        <Input
          id="page-name"
          v-model="nameDraft"
          placeholder="e.g. Computer Psycho Union"
          :disabled="!canManage || saving"
        />
      </div>

      <!-- Slug -->
      <div class="flex flex-col gap-2">
        <Label for="page-slug">Slug (public URL)</Label>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">/</span>
          <Input
            id="page-slug"
            v-model="slugDraft"
            placeholder="cpu"
            :disabled="!canManage || saving"
            class="font-mono"
          />
        </div>
        <p v-if="slugError" class="text-xs text-destructive">{{ slugError }}</p>
        <p v-else-if="slugChanging" class="text-xs text-emerald-600">
          New address: <code>/{{ normalSlug }}</code>
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Lives at <code>/{{ page.slug }}</code>
        </p>
      </div>

      <!-- Rename warning — emphasized when the slug is changing. -->
      <div
        v-if="slugChanging && !slugError"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
      >
        <div class="flex items-start gap-2">
          <Icon spec="TriangleAlert" :size="16" class="mt-0.5 shrink-0 text-amber-600" />
          <div class="text-sm">
            <p class="font-medium text-amber-700 dark:text-amber-400">
              Old links keep redirecting — until this slug is reused
            </p>
            <p class="mt-1 text-muted-foreground">
              After saving, <code>/{{ page.slug }}</code> (and any old links, posters, or QR codes
              pointing to it) will automatically redirect to <code>/{{ normalSlug }}</code
              >. The redirect follows the page across future renames, and it
              <strong
                >only stops once a new page claims <code>/{{ page.slug }}</code></strong
              >. Nothing breaks, but share the new address going forward.
            </p>
            <div class="mt-3">
              <Label for="confirm-slug" class="text-amber-700 dark:text-amber-400">
                Type the new slug to confirm: <code>{{ normalSlug }}</code>
              </Label>
              <Input
                id="confirm-slug"
                v-model="confirmDraft"
                :placeholder="normalSlug"
                :disabled="!canManage || saving"
                class="mt-1 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </form>

    <!-- Same shared save affordance as the rest of the app (own save path). -->
    <GuardedSave v-model:saving="saving" :dirty="dirty" :on-save="onSave" :on-discard="reset" />
  </section>
</template>
