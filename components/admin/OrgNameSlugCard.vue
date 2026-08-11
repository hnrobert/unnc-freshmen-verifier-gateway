<script setup lang="ts">
import { validateSlug } from '#shared/types'

// The "Name & URL" card — the last card on the Edit page. Edits the
// Organization entity (name + slug) via PATCH /api/orgs/:slug, which is a
// separate save path from the SiteConfig draft the rest of the editor uses, so
// this card has its own Save button. Owner-only: only a real owner can rename
// (a superadmin viewing another owner's org has a synthesized role, not real
// ownership, and the org won't appear in their /api/orgs list anyway).
const props = defineProps<{ slug: string }>()
const router = useRouter()

// Shared org list (same key as the dashboard layout → stays in sync, and the
// tab bar / breadcrumb pick up the new slug after a rename).
const { data: orgList, refresh: refreshOrgs } = await useFetch<{
  orgs: { slug: string; name: string; role: string }[]
}>('/api/orgs', { default: () => ({ orgs: [] }), key: 'orgs-list' })

const org = computed(() => orgList.value?.orgs.find((o) => o.slug === props.slug))
const canManage = computed(() => org.value?.role === 'owner')

const nameDraft = ref('')
const slugDraft = ref('')
const confirmDraft = ref('')
const saving = ref(false)

// Fill the drafts once, when the org resolves — never again, so edits are never
// clobbered while typing. The parent remounts this card on slug change
// (:key="slug") so navigating to another org starts fresh.
let initialized = false
watch(
  org,
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
const slugChanging = computed(() => normalSlug.value !== (org.value?.slug ?? ''))
const nameChanging = computed(() => nameDraft.value.trim() !== (org.value?.name ?? ''))
const dirty = computed(() => slugChanging.value || nameChanging.value)

const slugError = computed(() => (slugChanging.value ? validateSlug(normalSlug.value) : null))
const confirmed = computed(
  () => !slugChanging.value || confirmDraft.value.trim().toLowerCase() === normalSlug.value,
)
const canSave = computed(
  () => canManage.value && dirty.value && !slugError.value && confirmed.value && !saving.value,
)

function reset() {
  if (!org.value) return
  nameDraft.value = org.value.name
  slugDraft.value = org.value.slug
  confirmDraft.value = ''
}

async function onSave() {
  if (!canSave.value || !org.value) return
  saving.value = true
  try {
    const res = await $fetch<{
      org: { id: number; slug: string; name: string }
      renamed: boolean
      oldSlug: string | null
    }>(`/api/orgs/${props.slug}`, {
      method: 'PATCH',
      body: { name: nameDraft.value.trim(), slug: normalSlug.value },
    })
    toast.success(res.renamed ? 'Organization renamed' : 'Organization updated')
    confirmDraft.value = ''
    await refreshOrgs()
    if (res.renamed) {
      // The URL changed — relocate to the new slug's edit page.
      await router.replace(`/dashboard/${res.org.slug}/edit`)
    }
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section v-if="org && canManage" class="space-y-4">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Name &amp; URL
    </h3>
    <form class="flex flex-col gap-5" @submit.prevent="onSave">
      <!-- Name -->
      <div class="flex flex-col gap-2">
        <Label for="org-name">Organization name</Label>
        <Input
          id="org-name"
          v-model="nameDraft"
          placeholder="e.g. Computer Psycho Union"
          :disabled="!canManage || saving"
        />
      </div>

      <!-- Slug -->
      <div class="flex flex-col gap-2">
        <Label for="org-slug">Slug (public URL)</Label>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">/</span>
          <Input
            id="org-slug"
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
          Lives at <code>/{{ org.slug }}</code>
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
              After saving, <code>/{{ org.slug }}</code> (and any old links, posters, or QR codes
              pointing to it) will automatically redirect to <code>/{{ normalSlug }}</code
              >. The redirect follows the org across future renames, and it
              <strong
                >only stops once a new organization claims <code>/{{ org.slug }}</code></strong
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

      <div class="flex items-center gap-2">
        <Button type="submit" :disabled="!canSave">{{
          saving ? 'Saving…' : 'Save changes'
        }}</Button>
        <Button v-if="dirty" type="button" variant="ghost" :disabled="saving" @click="reset">
          Reset
        </Button>
      </div>
    </form>
  </section>
</template>
