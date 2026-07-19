<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface WhitelistConfig {
  enabled: boolean
  patterns: string[]
}
const { data: whitelist } = await useFetch<WhitelistConfig>('/api/admin/registration')
const wlEnabled = ref(false)
const wlPatternsText = ref('')
const wlSaving = ref(false)
const wlSaved = ref(false)
// Snapshot of the persisted values, for dirty tracking + discard.
const wlOriginal = ref({ enabled: false, patternsText: '' })
watch(
  whitelist,
  (w) => {
    if (!w) return
    const snap = { enabled: w.enabled, patternsText: w.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
  },
  { immediate: true },
)
const wlDirty = computed(
  () =>
    wlEnabled.value !== wlOriginal.value.enabled ||
    wlPatternsText.value !== wlOriginal.value.patternsText,
)
const { confirmLeave, proceed } = useUnsavedLeaveGuard(wlDirty, wlSaving)

async function saveWhitelist() {
  wlSaving.value = true
  wlSaved.value = false
  try {
    const patterns = wlPatternsText.value
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
    const res = await $fetch<WhitelistConfig>('/api/admin/registration', {
      method: 'PUT',
      body: { enabled: wlEnabled.value, patterns },
    })
    const snap = { enabled: res.enabled, patternsText: res.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
    wlSaved.value = true
    setTimeout(() => (wlSaved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
  } finally {
    wlSaving.value = false
  }
}
function discardWhitelist() {
  wlEnabled.value = wlOriginal.value.enabled
  wlPatternsText.value = wlOriginal.value.patternsText
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Registration</h1>
    <div class="mt-6 space-y-4 pb-24">
      <Card>
        <CardContent class="space-y-4">
          <div class="flex items-start gap-3">
            <input
              id="wl-enabled"
              v-model="wlEnabled"
              type="checkbox"
              class="mt-0.5 size-4 rounded border"
            />
            <div>
              <Label for="wl-enabled" class="cursor-pointer font-medium"
                >Restrict registration by email</Label
              >
              <p class="text-xs text-muted-foreground">
                When on, only emails matching a pattern below can register. Off = open registration
                (current default).
              </p>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label for="wl-patterns">Allowed email patterns (glob, one per line)</Label>
            <textarea
              id="wl-patterns"
              v-model="wlPatternsText"
              rows="8"
              spellcheck="false"
              class="w-full rounded-md border bg-transparent p-3 font-mono text-sm"
              placeholder="*@nottingham.edu.cn&#10;*@*.nottingham.edu.cn&#10;{john,jane}@example.com"
            ></textarea>
            <p class="text-xs text-muted-foreground">
              Glob: <code>*</code> any chars, <code>?</code> one char,
              <code>{a,b}</code> alternation. Case-insensitive. The first registration (superadmin
              bootstrap) is always allowed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <SaveBar
      :dirty="wlDirty"
      :saving="wlSaving"
      :saved="wlSaved"
      @save="saveWhitelist"
      @discard="discardWhitelist"
    />
    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="wlSaving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          discardWhitelist()
          proceed()
        }
      "
      @save="
        async () => {
          await saveWhitelist()
          proceed()
        }
      "
    />
  </div>
</template>
