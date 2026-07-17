<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { user } = useAuth()

// Email form
const emailForm = ref({ email: user.value?.email ?? '', error: '', saving: false, saved: false })

async function onSaveEmail() {
  emailForm.value.error = ''
  emailForm.value.saving = true
  emailForm.value.saved = false
  try {
    const res = await $fetch('/api/auth/me', { method: 'PATCH', body: { email: emailForm.value.email } })
    if (user.value) user.value.email = res.user.email
    emailForm.value.saved = true
    setTimeout(() => (emailForm.value.saved = false), 2000)
  } catch (e) {
    emailForm.value.error = messageFromError(e, 'Failed to update email')
  } finally {
    emailForm.value.saving = false
  }
}

// Password form
const pwForm = ref({ currentPassword: '', newPassword: '', confirm: '', error: '', saving: false, saved: false })

async function onSavePassword() {
  pwForm.value.error = ''
  if (pwForm.value.newPassword !== pwForm.value.confirm) {
    pwForm.value.error = 'Passwords do not match'
    return
  }
  pwForm.value.saving = true
  pwForm.value.saved = false
  try {
    await $fetch('/api/auth/me', {
      method: 'PATCH',
      body: { currentPassword: pwForm.value.currentPassword, newPassword: pwForm.value.newPassword },
    })
    pwForm.value.currentPassword = ''
    pwForm.value.newPassword = ''
    pwForm.value.confirm = ''
    pwForm.value.saved = true
    setTimeout(() => (pwForm.value.saved = false), 2000)
  } catch (e) {
    pwForm.value.error = messageFromError(e, 'Failed to update password')
  } finally {
    pwForm.value.saving = false
  }
}
</script>

<template>
  <div class="max-w-md space-y-8">
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>

    <!-- Email -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Email</CardTitle>
        <CardDescription>Change the email associated with your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSaveEmail">
          <Label for="settings-email">New email</Label>
          <Input id="settings-email" v-model="emailForm.email" type="email" :disabled="emailForm.saving" />
          <StatusAlert v-if="emailForm.error" variant="error" :message="emailForm.error" />
          <div class="flex items-center gap-3">
            <Button type="submit" size="sm" :disabled="emailForm.saving || emailForm.email === user?.email">
              {{ emailForm.saving ? 'Saving…' : 'Save email' }}
            </Button>
            <span v-if="emailForm.saved" class="text-sm text-emerald-600">✓ Saved</span>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- Password -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Password</CardTitle>
        <CardDescription>Change your password. Current password required.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSavePassword">
          <div class="flex flex-col gap-2">
            <Label for="settings-pw-current">Current password</Label>
            <Input id="settings-pw-current" v-model="pwForm.currentPassword" type="password" placeholder="••••••••" autocomplete="current-password" :disabled="pwForm.saving" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="settings-pw-new">New password</Label>
            <Input id="settings-pw-new" v-model="pwForm.newPassword" type="password" placeholder="min 8 characters" autocomplete="new-password" :disabled="pwForm.saving" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="settings-pw-confirm">Confirm new password</Label>
            <Input id="settings-pw-confirm" v-model="pwForm.confirm" type="password" placeholder="re-enter password" autocomplete="new-password" :disabled="pwForm.saving" />
          </div>
          <StatusAlert v-if="pwForm.error" variant="error" :message="pwForm.error" />
          <div class="flex items-center gap-3">
            <Button type="submit" size="sm" :disabled="pwForm.saving || !pwForm.currentPassword || !pwForm.newPassword">
              {{ pwForm.saving ? 'Saving…' : 'Save password' }}
            </Button>
            <span v-if="pwForm.saved" class="text-sm text-emerald-600">✓ Saved</span>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
