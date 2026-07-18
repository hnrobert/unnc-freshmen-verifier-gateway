<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const route = useRoute()
const { login, loginWithPasskey } = useAuth()
const { email, password } = useAuthForm()

const error = ref('')
const loading = ref(false)
const pkSupported = ref(false)
const pkLoading = ref(false)

// Passkeys need a secure context (HTTPS or localhost) — hide the button where
// the browser can't use WebAuthn at all.
onMounted(async () => {
  const { browserSupportsWebAuthn } = await import('@simplewebauthn/browser')
  pkSupported.value = browserSupportsWebAuthn()
})

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo((route.query.redirect as string) || '/dashboard')
  } catch (e: unknown) {
    error.value = messageFromError(e, 'Login failed')
  } finally {
    loading.value = false
  }
}

async function onPasskey() {
  error.value = ''
  pkLoading.value = true
  try {
    await loginWithPasskey()
    await navigateTo((route.query.redirect as string) || '/dashboard')
  } catch (e: unknown) {
    error.value = messageFromError(e, 'Passkey sign-in failed')
  } finally {
    pkLoading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Log in</CardTitle>
      <CardDescription>Access your organizations.</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" placeholder="you@example.com" autocomplete="email" :disabled="loading" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <Input id="password" v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" :disabled="loading" />
        </div>
        <StatusAlert v-if="error" variant="error" :message="error" />
        <Button type="submit" :disabled="loading" class="mt-1">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </Button>

        <template v-if="pkSupported">
          <div class="relative my-1">
            <div class="absolute inset-0 flex items-center"><span class="w-full border-t"></span></div>
            <div class="relative flex justify-center text-xs uppercase"><span class="bg-card px-2 text-muted-foreground">or</span></div>
          </div>
          <Button type="button" variant="outline" :disabled="pkLoading || loading" @click="onPasskey">
            {{ pkLoading ? '…' : 'Sign in with passkey' }}
          </Button>
        </template>
      </form>
    </CardContent>
    <CardFooter class="justify-center text-sm text-muted-foreground">
      No account? <NuxtLink to="/register" class="ml-1 font-medium text-foreground underline hover:opacity-70">Register</NuxtLink>
    </CardFooter>
  </Card>
</template>
