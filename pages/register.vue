<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { register, sendVerificationCode } = useAuth()
const { email, password, confirm } = useAuthForm()

const code = ref('')
const loading = ref(false)
const sending = ref(false)
// Client flow token binding the emailed code to this registration attempt.
const session = useState<string>('reg-session', () => '')

// 60s resend countdown (mirrors the backend 1/min-per-email limit).
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
function startCountdown() {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const emailValid = computed(() => EMAIL_RE.test(email.value.trim()))
const canSend = computed(() => emailValid.value && countdown.value <= 0 && !sending.value)

async function onSendCode() {
  if (!canSend.value) return
  sending.value = true
  try {
    if (!session.value) session.value = crypto.randomUUID()
    await sendVerificationCode(email.value.trim(), session.value)
    toast.success('Verification code sent — check your email')
    startCountdown()
  } catch (e: unknown) {
    toast.error(messageFromError(e, 'Could not send code'))
  } finally {
    sending.value = false
  }
}

async function onSubmit() {
  if (password.value !== confirm.value) {
    toast.error('Passwords do not match')
    return
  }
  if (!code.value) {
    toast.error('Please enter the verification code')
    return
  }
  loading.value = true
  try {
    if (!session.value) session.value = crypto.randomUUID()
    await register(email.value.trim(), password.value, code.value.trim(), session.value)
    await navigateTo('/dashboard')
  } catch (e: unknown) {
    toast.error(messageFromError(e, 'Registration failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Create account</CardTitle>
      <CardDescription>Register to create your own verify gateway.</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            :disabled="loading"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label for="code">Verification code</Label>
            <button
              type="button"
              class="text-xs font-medium text-foreground underline hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canSend"
              @click="onSendCode"
            >
              <span v-if="sending">Sending…</span>
              <span v-else-if="countdown > 0">Resend ({{ countdown }}s)</span>
              <span v-else>Send code</span>
            </button>
          </div>
          <Input
            id="code"
            v-model="code"
            inputmode="numeric"
            placeholder="6-digit code"
            autocomplete="one-time-code"
            :disabled="loading"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            placeholder="min 8 characters"
            autocomplete="new-password"
            :disabled="loading"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="confirm">Confirm password</Label>
          <Input
            id="confirm"
            v-model="confirm"
            type="password"
            placeholder="re-enter password"
            autocomplete="new-password"
            :disabled="loading"
          />
        </div>
        <Button type="submit" :disabled="loading" class="mt-1">
          {{ loading ? 'Creating…' : 'Register' }}
        </Button>
      </form>
    </CardContent>
    <CardFooter class="justify-center text-sm text-muted-foreground">
      Already have an account?
      <NuxtLink to="/login" class="ml-1 font-medium text-foreground underline hover:opacity-70"
        >Log in</NuxtLink
      >
    </CardFooter>
  </Card>
</template>
