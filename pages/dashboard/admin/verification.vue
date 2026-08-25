<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface VerificationSettings {
  freshmanEnabled: boolean
  emailMode: 'welcome' | 'code'
}

const { data: settings } = await useFetch<VerificationSettings>('/api/admin/verification')

const freshmanEnabled = ref(true)
const emailMode = ref<'welcome' | 'code'>('welcome')
const saving = ref(false)
const saved = ref(false)
const original = ref({ freshmanEnabled: true, emailMode: 'welcome' as 'welcome' | 'code' })

watch(
  settings,
  (s) => {
    if (!s) return
    freshmanEnabled.value = s.freshmanEnabled
    emailMode.value = s.emailMode
    original.value = { freshmanEnabled: s.freshmanEnabled, emailMode: s.emailMode }
  },
  { immediate: true },
)

const dirty = computed(
  () =>
    freshmanEnabled.value !== original.value.freshmanEnabled ||
    emailMode.value !== original.value.emailMode,
)
const { confirmLeave, proceed } = useUnsavedLeaveGuard(dirty, saving)

async function onSave(): Promise<void> {
  saving.value = true
  saved.value = false
  try {
    const res = await $fetch<VerificationSettings>('/api/admin/verification', {
      method: 'PUT',
      body: { freshmanEnabled: freshmanEnabled.value, emailMode: emailMode.value },
    })
    freshmanEnabled.value = res.freshmanEnabled
    emailMode.value = res.emailMode
    original.value = { freshmanEnabled: res.freshmanEnabled, emailMode: res.emailMode }
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Failed to save'))
  } finally {
    saving.value = false
  }
}

function onDiscard(): void {
  freshmanEnabled.value = original.value.freshmanEnabled
  emailMode.value = original.value.emailMode
}
</script>

<template>
  <div class="max-w-xl space-y-6 pb-24">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">Verification</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Site-wide switches for the public verification flows.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">Freshman verification</CardTitle>
        <CardDescription>
          The name + ID flow on every public page (portal check, mock, and trusted/reused cookies).
          Turning it off hides the tab and refuses
          <code>/check</code> site-wide.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="size-4 shrink-0"
            style="accent-color: var(--primary)"
            :checked="freshmanEnabled"
            @change="freshmanEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span>Enable freshman (name + ID) verification</span>
        </label>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">Email verification mode</CardTitle>
        <CardDescription>
          What the public email tab does for @nottingham.edu.cn addresses.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          :class="emailMode === 'welcome' ? 'border-primary bg-primary/5' : ''"
          @click="emailMode = 'welcome'"
        >
          <input
            type="radio"
            name="email-mode"
            class="mt-0.5 size-4 shrink-0"
            style="accent-color: var(--primary)"
            :checked="emailMode === 'welcome'"
          />
          <span>
            <span class="font-medium">Mail welcome content</span>
            <span class="block text-xs text-muted-foreground">
              Current default — the welcome page content is emailed directly to the address (no
              trust granted).
            </span>
          </span>
        </label>
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          :class="emailMode === 'code' ? 'border-primary bg-primary/5' : ''"
          @click="emailMode = 'code'"
        >
          <input
            type="radio"
            name="email-mode"
            class="mt-0.5 size-4 shrink-0"
            style="accent-color: var(--primary)"
            :checked="emailMode === 'code'"
          />
          <span>
            <span class="font-medium">Email + verification code</span>
            <span class="block text-xs text-muted-foreground">
              Sends a 6-digit code; verifying grants the same trusted-visitor cookie as the freshman
              flow, valid for 30 days.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>

    <SaveBar :dirty="dirty" :saving="saving" :saved="saved" @save="onSave" @discard="onDiscard" />

    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="saving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          onDiscard()
          proceed()
        }
      "
      @save="
        async () => {
          await onSave()
          proceed()
        }
      "
    />
  </div>
</template>
