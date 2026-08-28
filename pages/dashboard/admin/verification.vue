<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface VerificationSettings {
  freshmanEnabled: boolean
  emailModes: ('welcome' | 'code')[]
}

const { data: settings } = await useFetch<VerificationSettings>('/api/admin/verification')

const freshmanEnabled = ref(true)
const welcomeMode = ref(true)
const codeMode = ref(false)
// Mirrored from GuardedSave so the controls can disable themselves mid-save.
const saving = ref(false)
const original = ref({ freshmanEnabled: true, welcome: true, code: false })

watch(
  settings,
  (s) => {
    if (!s) return
    freshmanEnabled.value = s.freshmanEnabled
    welcomeMode.value = s.emailModes.includes('welcome')
    codeMode.value = s.emailModes.includes('code')
    original.value = {
      freshmanEnabled: s.freshmanEnabled,
      welcome: welcomeMode.value,
      code: codeMode.value,
    }
  },
  { immediate: true },
)

const emailModes = computed(() => {
  const modes: ('welcome' | 'code')[] = []
  if (welcomeMode.value) modes.push('welcome')
  if (codeMode.value) modes.push('code')
  return modes
})

const dirty = computed(
  () =>
    freshmanEnabled.value !== original.value.freshmanEnabled ||
    welcomeMode.value !== original.value.welcome ||
    codeMode.value !== original.value.code,
)
async function onSave(): Promise<boolean> {
  try {
    const res = await $fetch<VerificationSettings>('/api/admin/verification', {
      method: 'PUT',
      body: { freshmanEnabled: freshmanEnabled.value, emailModes: emailModes.value },
    })
    freshmanEnabled.value = res.freshmanEnabled
    welcomeMode.value = res.emailModes.includes('welcome')
    codeMode.value = res.emailModes.includes('code')
    original.value = {
      freshmanEnabled: res.freshmanEnabled,
      welcome: welcomeMode.value,
      code: codeMode.value,
    }
    return true
  } catch (e) {
    toast.error(messageFromError(e, 'Failed to save'))
    return false
  }
}

function onDiscard(): void {
  freshmanEnabled.value = original.value.freshmanEnabled
  welcomeMode.value = original.value.welcome
  codeMode.value = original.value.code
}
</script>

<template>
  <div class="max-w-xl space-y-6">
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
        <CardTitle class="text-base">Email verification modes</CardTitle>
        <CardDescription>
          What the public email tab offers for @nottingham.edu.cn addresses. Select any combination
          — with both, visitors pick a flow; with one, it's the only path; with none, the email tab
          is hidden.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          :class="welcomeMode ? 'border-primary bg-primary/5' : ''"
        >
          <input
            type="checkbox"
            class="mt-0.5 size-4 shrink-0"
            style="accent-color: var(--primary)"
            :checked="welcomeMode"
            @change="welcomeMode = ($event.target as HTMLInputElement).checked"
          />
          <span>
            <span class="font-medium">Mail welcome content</span>
            <span class="block text-xs text-muted-foreground">
              The welcome page content is emailed directly to the address (no trust granted).
            </span>
          </span>
        </label>
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          :class="codeMode ? 'border-primary bg-primary/5' : ''"
        >
          <input
            type="checkbox"
            class="mt-0.5 size-4 shrink-0"
            style="accent-color: var(--primary)"
            :checked="codeMode"
            @change="codeMode = ($event.target as HTMLInputElement).checked"
          />
          <span>
            <span class="font-medium">Email + verification code</span>
            <span class="block text-xs text-muted-foreground">
              Sends a 6-digit code; verifying grants the same trusted-visitor cookie as the freshman
              flow, valid for 30 days.
            </span>
          </span>
        </label>
        <p v-if="!welcomeMode && !codeMode" class="text-xs text-amber-600 dark:text-amber-400">
          No email mode selected — the email tab will be hidden on every public page.
        </p>
      </CardContent>
    </Card>

    <GuardedSave v-model:saving="saving" :dirty="dirty" :on-save="onSave" :on-discard="onDiscard" />
  </div>
</template>
