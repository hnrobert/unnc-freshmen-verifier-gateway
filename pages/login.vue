<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const route = useRoute()
const { login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
      </form>
    </CardContent>
    <CardFooter class="justify-center text-sm text-muted-foreground">
      No account? <NuxtLink to="/register" class="ml-1 font-medium text-primary hover:underline">Register</NuxtLink>
    </CardFooter>
  </Card>
</template>
