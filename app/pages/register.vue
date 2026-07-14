<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { register } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await register(email.value, password.value)
    await navigateTo('/dashboard')
  } catch (e: unknown) {
    error.value = messageFromError(e, 'Registration failed')
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
          <Input id="email" v-model="email" type="email" placeholder="you@example.com" autocomplete="email" :disabled="loading" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <Input id="password" v-model="password" type="password" placeholder="min 8 characters" autocomplete="new-password" :disabled="loading" />
        </div>
        <StatusAlert v-if="error" variant="error" :message="error" />
        <Button type="submit" :disabled="loading" class="mt-1">
          {{ loading ? 'Creating…' : 'Register' }}
        </Button>
      </form>
    </CardContent>
    <CardFooter class="justify-center text-sm text-muted-foreground">
      Already have an account? <NuxtLink to="/login" class="ml-1 font-medium text-primary hover:underline">Log in</NuxtLink>
    </CardFooter>
  </Card>
</template>
