<script setup lang="ts">
import {
  SITE_AUTHOR_NAME,
  SITE_AUTHOR_URL,
  SITE_LICENSE,
  SITE_LICENSE_URL,
  SITE_ORG_NAME,
  SITE_ORG_URL,
  SITE_REPO_URL,
  SITE_TITLE,
} from '#shared/lib/site'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-[1vh] px-4 py-4 text-center text-xs text-muted-foreground">
    <div class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
      <span
        >© {{ year }}
        <NuxtLink to="/" class="underline-offset-2 hover:underline">{{
          SITE_TITLE
        }}</NuxtLink></span
      >
      <span aria-hidden="true">·</span>
      <a
        :href="SITE_LICENSE_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >{{ SITE_LICENSE }}</a
      >
      <span aria-hidden="true">·</span>
      <a
        :href="SITE_REPO_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >GitHub</a
      >
    </div>
    <div class="mt-1">
      Made with heart by
      <a
        :href="SITE_AUTHOR_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >{{ SITE_AUTHOR_NAME }}</a
      >
      @
      <a
        :href="SITE_ORG_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >{{ SITE_ORG_NAME }}</a
      >
    </div>
  </footer>
</template>
