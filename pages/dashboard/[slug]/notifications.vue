<script setup lang="ts">
import { REMINDER_SLOTS, type ReminderSlot } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

interface NotifOverride {
  notifyExpiry: boolean | null
  reminderSlots: ReminderSlot[] | null
  reminderTime: string | null
}
interface EffectivePref {
  enabled: boolean
  slots: ReminderSlot[]
  time: string
  tz: string
}
interface NotifResult {
  orgName: string
  expiresAt: string | null
  override: NotifOverride | null
  effective: EffectivePref
}

const { data, refresh } = await useFetch<NotifResult>(
  () => `/api/orgs/${slug.value}/me/notifications`,
  { watch: [slug] },
)

const SLOT_LABELS: Record<ReminderSlot, string> = {
  '-3d': '3 days before',
  '-2d': '2 days before',
  '-1d': '1 day before',
  'day-of': 'On the day',
}

// One draft for the whole page — the inherit toggle plus the custom schedule —
// saved together via the bottom save/discard bar (same pattern as account
// Settings and the config editor). `inherit` = use the account default (the
// custom fields are then read-only, showing what's currently in effect).
interface Draft {
  inherit: boolean
  enabled: boolean
  slots: ReminderSlot[]
  time: string
}
function seedDraft(d: NotifResult | null | undefined): Draft {
  const eff = d?.effective
  const ov = d?.override
  return {
    inherit: ov == null,
    enabled: ov?.notifyExpiry ?? eff?.enabled ?? true,
    slots: ov?.reminderSlots ?? [...(eff?.slots ?? [])],
    time: ov?.reminderTime ?? eff?.time ?? '12:00',
  }
}
const original = ref<Draft>(seedDraft(data.value))
const draft = ref<Draft>(seedDraft(data.value))
const saving = ref(false)
const saved = ref(false)

function slotsEqual(a: ReminderSlot[], b: ReminderSlot[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s) => b.includes(s))
}
const isDirty = computed(
  () =>
    draft.value.inherit !== original.value.inherit ||
    draft.value.enabled !== original.value.enabled ||
    draft.value.time !== original.value.time ||
    !slotsEqual(draft.value.slots, original.value.slots),
)

// Unsaved-changes prompt on leave (matches the config editor + Settings).
const { confirmLeave, proceed } = useUnsavedLeaveGuard(isDirty, saving)

// In inherit mode the controls render the resolved effective schedule (disabled,
// read-only); in custom mode they render the editable draft.
const controlsModel = computed(() =>
  draft.value.inherit
    ? {
        enabled: data.value?.effective.enabled ?? false,
        slots: data.value?.effective.slots ?? [],
        time: data.value?.effective.time ?? '12:00',
      }
    : { enabled: draft.value.enabled, slots: draft.value.slots, time: draft.value.time },
)

const expiryDate = computed(() => {
  const s = data.value?.expiresAt
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString()
})

function formatSlots(slots: ReminderSlot[]): string {
  const ordered = REMINDER_SLOTS.filter((s) => slots.includes(s))
  return ordered.map((s) => SLOT_LABELS[s].toLowerCase()).join(', ')
}

const effectiveReadout = computed(() => {
  const eff = data.value?.effective
  if (!eff) return ''
  if (!eff.enabled) return 'Reminders are turned off.'
  if (eff.slots.length === 0) return 'No reminder days are selected, so no emails will be sent.'
  return `You'll be reminded ${formatSlots(eff.slots)} at ${eff.time} (${eff.tz}).`
})

function reseed(): void {
  original.value = seedDraft(data.value)
  draft.value = seedDraft(data.value)
}

async function onSave(): Promise<void> {
  saving.value = true
  saved.value = false
  try {
    await $fetch(`/api/orgs/${slug.value}/me/notifications`, {
      method: 'PATCH',
      body: draft.value.inherit
        ? { inherit: true }
        : {
            notifyExpiry: draft.value.enabled,
            reminderSlots: draft.value.slots,
            reminderTime: draft.value.time,
          },
    })
    await refresh()
    reseed()
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Could not save'))
  } finally {
    saving.value = false
  }
}

function onDiscard(): void {
  draft.value = { ...original.value, slots: [...original.value.slots] }
}
</script>

<template>
  <div class="space-y-6 pb-24">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Notifications</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Choose when this page should remind you before its expiry date.
      </p>
    </div>

    <Card v-if="data">
      <CardHeader>
        <CardTitle class="text-base">{{ data.orgName }}</CardTitle>
        <CardDescription>
          Expires <span class="font-medium">{{ expiryDate ?? '— no expiry date set' }}</span>
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div
          v-if="!data.expiresAt"
          class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
        >
          This page has no expiry date configured, so no reminders will be sent.
        </div>

        <div class="space-y-1.5 border-t pt-4">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="size-4 shrink-0"
              style="accent-color: var(--primary)"
              :checked="draft.inherit"
              :disabled="saving"
              @change="draft.inherit = ($event.target as HTMLInputElement).checked"
            />
            <span>Use my account default</span>
          </label>
          <p class="pl-6 text-xs text-muted-foreground">
            When on, this page uses the schedule from your account settings.
          </p>
        </div>

        <div class="border-t pt-4">
          <ReminderControls :model-value="controlsModel" :disabled="saving || draft.inherit" />
        </div>

        <div class="rounded-md bg-muted/40 p-3 text-sm">
          <span class="text-muted-foreground">Effective: </span>{{ effectiveReadout }}
        </div>
      </CardContent>
    </Card>

    <!-- Sticky save/discard bar (dirty tracking + save logic live in this page) -->
    <SaveBar :dirty="isDirty" :saving="saving" :saved="saved" @save="onSave" @discard="onDiscard" />

    <!-- Unsaved changes leave dialog -->
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
