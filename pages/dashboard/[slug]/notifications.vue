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

// Whether this org currently uses the account default (no override row).
const inherits = ref(data.value?.override === null)
// Draft for custom mode, seeded from the override (falling back to the resolved
// effective schedule) so un-touched fields start at what's currently in effect.
const draft = ref<{ enabled: boolean; slots: ReminderSlot[]; time: string }>({
  enabled: data.value?.override?.notifyExpiry ?? data.value?.effective.enabled ?? true,
  slots: data.value?.override?.reminderSlots ?? data.value?.effective.slots ?? [],
  time: data.value?.override?.reminderTime ?? data.value?.effective.time ?? '12:00',
})
const saving = ref(false)

// In inherit mode the controls render the resolved effective schedule (disabled,
// read-only); in custom mode they render the editable draft.
const controlsModel = computed(() =>
  inherits.value
    ? {
        enabled: data.value?.effective.enabled ?? false,
        slots: data.value?.effective.slots ?? [],
        time: data.value?.effective.time ?? '12:00',
      }
    : draft.value,
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

async function onToggleInherit(e: Event): Promise<void> {
  const val = (e.target as HTMLInputElement).checked
  saving.value = true
  try {
    if (val) {
      await $fetch(`/api/orgs/${slug.value}/me/notifications`, {
        method: 'PATCH',
        body: { inherit: true },
      })
      inherits.value = true
      toast.success('Using your account default for this org')
    } else {
      // Seed the custom draft from the current effective schedule, then persist it
      // so the override row exists and the controls become editable.
      const eff = data.value?.effective
      if (eff) draft.value = { enabled: eff.enabled, slots: [...eff.slots], time: eff.time }
      await $fetch(`/api/orgs/${slug.value}/me/notifications`, {
        method: 'PATCH',
        body: {
          notifyExpiry: draft.value.enabled,
          reminderSlots: draft.value.slots,
          reminderTime: draft.value.time,
        },
      })
      inherits.value = false
      toast.success('Custom reminder saved')
    }
    await refresh()
  } catch (err) {
    toast.error(messageFromError(err, 'Could not save'))
    await refresh()
    inherits.value = data.value?.override === null
  } finally {
    saving.value = false
  }
}

async function onDraftChange(val: {
  enabled: boolean
  slots: ReminderSlot[]
  time: string
}): Promise<void> {
  draft.value = val
  saving.value = true
  try {
    await $fetch(`/api/orgs/${slug.value}/me/notifications`, {
      method: 'PATCH',
      body: {
        notifyExpiry: val.enabled,
        reminderSlots: val.slots,
        reminderTime: val.time,
      },
    })
    toast.success('Reminder preference saved')
    await refresh()
  } catch (err) {
    toast.error(messageFromError(err, 'Could not save'))
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-md space-y-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Notifications</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Choose when this organization should remind you before its expiry date.
      </p>
    </div>

    <Card v-if="data">
      <CardContent class="space-y-4 p-6">
        <div class="text-sm">
          <span class="text-muted-foreground">{{ data.orgName }} expires</span>
          <span class="ml-1 font-medium">{{ expiryDate ?? '— no expiry date set' }}</span>
        </div>

        <div
          v-if="!data.expiresAt"
          class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
        >
          This organization has no expiry date configured, so no reminders will be sent.
        </div>

        <div class="space-y-1.5 border-t pt-4">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="size-4 shrink-0"
              style="accent-color: var(--primary)"
              :checked="inherits"
              :disabled="saving"
              @change="onToggleInherit"
            />
            <span>Use my account default</span>
          </label>
          <p class="pl-6 text-xs text-muted-foreground">
            When on, this org uses the schedule from your account settings.
          </p>
        </div>

        <div class="border-t pt-4">
          <ReminderControls
            :model-value="controlsModel"
            :disabled="saving || inherits"
            @update:model-value="onDraftChange"
          />
        </div>

        <div class="rounded-md bg-muted/40 p-3 text-sm">
          <span class="text-muted-foreground">Effective: </span>{{ effectiveReadout }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
