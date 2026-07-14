<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

const slug = ref('')
const name = ref('')
const error = ref('')
const loading = ref(false)

const slugHint = computed(() => {
  const s = slug.value.trim().toLowerCase()
  if (!s) return ''
  return SLUG_RE.test(s) ? 'looks good' : '3–32 chars: lowercase letters, digits, hyphens'
})

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    const res = await $fetch<{ org: { slug: string } }>('/api/orgs', {
      method: 'POST',
      body: { slug: slug.value.trim().toLowerCase(), name: name.value.trim() },
    })
    await navigateTo(`/dashboard/${res.org.slug}/edit`)
  } catch (e) {
    error.value = messageFromError(e, 'Could not create organization')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-md">
    <h1 class="text-2xl font-semibold tracking-tight">New organization</h1>
    <p class="mt-1 text-sm text-muted-foreground">Choose a slug — your gateway lives at <code>/&lt;slug&gt;</code>.</p>

    <Card class="mt-6">
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <Label for="name">Organization name</Label>
            <Input id="name" v-model="name" placeholder="e.g. UNNC Freshmen 2026" :disabled="loading" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="slug">Slug</Label>
            <Input id="slug" v-model="slug" placeholder="unnc-2026" :disabled="loading" />
            <p v-if="slugHint" class="text-xs" :class="slugHint === 'looks good' ? 'text-emerald-600' : 'text-muted-foreground'">
              {{ slugHint }}
            </p>
          </div>
          <StatusAlert v-if="error" variant="error" :message="error" />
          <Button type="submit" :disabled="loading" class="mt-1">
            {{ loading ? 'Creating…' : 'Create' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
