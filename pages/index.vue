<script setup lang="ts">
import type { DirectiveBinding } from 'vue'
import { defineComponent, h } from 'vue'
import { useColorMode, useIntersectionObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  BarChart3,
  Check,
  Mail,
  Moon,
  Palette,
  ScanLine,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-vue-next'
import { SITE_REPO_URL } from '#shared/lib/site'

// The root `/` has no org, so the org-scoped default layout, BrandMark and
// LanguageToggle (which all read `useOrgConfig()`) can't be reused. This page is
// self-contained: it applies the site's default theme vars directly and ships
// its own minimal header + locale/theme toggles.
definePageMeta({ layout: false })

const { t, locale } = useI18n()

// Persisted locale (shared with org pages, which use the same `vg.locale`
// cookie) so a language choice survives cross-page navigation.
const localeCookie = useCookie<string>('vg.locale', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})

// Browser language for first-visit detection — Accept-Language on SSR,
// navigator on client. They match, so SSR paints the right locale (no flash).
const acceptLanguage = import.meta.server
  ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
  : typeof navigator !== 'undefined'
    ? navigator.language
    : ''

function detectLocale(): 'zh' | 'en' {
  if (localeCookie.value === 'zh' || localeCookie.value === 'en') return localeCookie.value
  return /zh/i.test(acceptLanguage) ? 'zh' : 'en'
}
locale.value = detectLocale()
watch(locale, (v) => {
  if (v === 'zh' || v === 'en') localeCookie.value = v
})

const mode = useColorMode({ storageKey: 'vg.theme' })

// lucide-vue-next v1 deprecated its brand icons, so render the GitHub mark as a
// small inline SVG (currentColor, scales with `size`).
const GithubMark = defineComponent({
  name: 'GithubMark',
  props: { size: { type: Number, default: 18 } },
  setup: (props) => () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: props.size,
        height: props.size,
        fill: 'currentColor',
        'aria-hidden': true,
      },
      [
        h('path', {
          d: 'M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.23-3.15-.12-.3-.53-1.51.12-3.15 0 0 1-.32 3.3 1.2a11.6 11.6 0 0 1 6 0c2.28-1.52 3.28-1.2 3.28-1.2.66 1.64.25 2.85.12 3.15.77.82 1.23 1.87 1.23 3.15 0 4.51-2.81 5.5-5.49 5.79.43.36.81 1.09.81 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.21.68.83.56A12.04 12.04 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z',
        }),
      ],
    ),
})

useHead({
  title: () => t('home.title'),
  htmlAttrs: { lang: () => (locale.value === 'zh' ? 'zh-CN' : 'en') },
  meta: [{ name: 'description', content: () => t('home.subtitle') }],
})

const features = computed(() => [
  {
    icon: ShieldCheck,
    title: t('home.f1Title'),
    desc: t('home.f1Desc'),
    span: 'lg:col-span-3',
    wide: false,
  },
  {
    icon: Palette,
    title: t('home.f2Title'),
    desc: t('home.f2Desc'),
    span: 'lg:col-span-3',
    wide: false,
  },
  {
    icon: Users,
    title: t('home.f3Title'),
    desc: t('home.f3Desc'),
    span: 'lg:col-span-2',
    wide: false,
  },
  {
    icon: BarChart3,
    title: t('home.f4Title'),
    desc: t('home.f4Desc'),
    span: 'lg:col-span-2',
    wide: false,
  },
  {
    icon: Mail,
    title: t('home.f5Title'),
    desc: t('home.f5Desc'),
    span: 'lg:col-span-2',
    wide: false,
  },
  {
    icon: ScanLine,
    title: t('home.f6Title'),
    desc: t('home.f6Desc'),
    span: 'lg:col-span-6',
    wide: true,
  },
])

const steps = computed(() => [
  { n: '01', title: t('home.step1Title'), desc: t('home.step1Desc') },
  { n: '02', title: t('home.step2Title'), desc: t('home.step2Desc') },
  { n: '03', title: t('home.step3Title'), desc: t('home.step3Desc') },
])

// Fade/translate an element in once it scrolls into view. The `.reveal` base
// class holds the pre-animation state (so SSR + first paint are identical and
// screen readers still read opacity:0 content); this just flips `.is-in`.
const vReveal = {
  mounted(el: HTMLElement, binding: DirectiveBinding<number | undefined>) {
    if (binding.value != null) el.style.transitionDelay = `${binding.value}ms`
    const { stop } = useIntersectionObserver(
      el,
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-in')
          stop()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
  },
}
</script>

<template>
  <div
    class="relative min-h-screen bg-background text-foreground antialiased"
    :style="{
      '--radius': '0.65rem',
      '--primary': '#F7D447',
      '--primary-foreground': '#1c1917',
      '--ring': '#F7D447',
    }"
  >
    <!-- animated decorative gold blobs -->
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        class="blob blob-a absolute -top-48 left-1/2 size-144 rounded-full bg-primary/10 blur-3xl"
      ></div>
      <div
        class="blob blob-b absolute -right-32 top-1/3 size-72 rounded-full bg-primary/[0.07] blur-3xl"
      ></div>
    </div>

    <!-- Header -->
    <header class="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <a href="/" class="group flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            class="size-9 rounded-lg shadow-sm transition-transform duration-300 group-hover:-rotate-6"
          />
          <span class="text-[15px] font-semibold tracking-tight"
            >UNNC Freshmen Verifier Gateway</span
          >
        </a>
        <nav class="flex items-center gap-1 sm:gap-2">
          <a
            href="#features"
            class="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >{{ t('home.navFeatures') }}</a
          >
          <a
            href="#how"
            class="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >{{ t('home.navHow') }}</a
          >
          <a
            :href="SITE_REPO_URL"
            target="_blank"
            rel="noopener"
            :aria-label="t('home.navSource')"
            :title="t('home.navSource')"
            class="inline-flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <GithubMark :size="18" />
          </a>
          <!-- language toggle -->
          <div
            class="inline-flex items-center rounded-md border border-border/70 p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              :class="
                locale === 'zh'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              class="rounded-[5px] px-2 py-1 transition-colors"
              @click="locale = 'zh'"
            >
              中
            </button>
            <button
              type="button"
              :class="
                locale === 'en'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              class="rounded-[5px] px-2 py-1 transition-colors"
              @click="locale = 'en'"
            >
              EN
            </button>
          </div>
          <!-- theme toggle -->
          <button
            type="button"
            :aria-label="t('home.themeToggle')"
            :title="t('home.themeToggle')"
            class="inline-flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            @click="mode = mode === 'dark' ? 'light' : 'dark'"
          >
            <Sun v-if="mode === 'dark'" :size="18" />
            <Moon v-else :size="18" />
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-5">
      <!-- Hero -->
      <section
        class="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
      >
        <div>
          <span
            v-reveal
            class="reveal inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <span class="size-1.5 rounded-full bg-primary"></span>
            {{ t('home.badge') }}
          </span>
          <h1
            v-reveal="80"
            class="reveal mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]"
          >
            {{ t('home.title') }}
          </h1>
          <p
            v-reveal="160"
            class="reveal mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {{ t('home.subtitle') }}
          </p>
          <div v-reveal="240" class="reveal mt-8 flex flex-wrap items-center gap-3">
            <NuxtLink
              to="/dashboard"
              class="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              {{ t('home.cta') }}
              <ArrowRight
                :size="17"
                class="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>
            <a
              :href="SITE_REPO_URL"
              target="_blank"
              rel="noopener"
              class="inline-flex h-11 items-center gap-2 rounded-lg border border-border/70 px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <GithubMark :size="17" />
              {{ t('home.secondary') }}
            </a>
          </div>
        </div>

        <!-- Verify-card mock (stylized product preview, theme-driven) -->
        <div v-reveal="200" class="reveal relative">
          <div
            aria-hidden="true"
            class="absolute inset-5 -z-10 rounded-4xl bg-primary/15 blur-2xl"
          ></div>
          <div
            class="mock-card mx-auto w-full max-w-sm rounded-2xl border border-border/70 bg-card p-6 shadow-xl shadow-black/5"
          >
            <div class="flex items-center gap-3">
              <img src="/favicon.svg" alt="" class="size-10 rounded-lg shadow-sm" />
              <div class="space-y-1.5">
                <div class="h-2.5 w-24 rounded-full bg-foreground/80"></div>
                <div class="h-2 w-16 rounded-full bg-muted-foreground/40"></div>
              </div>
            </div>
            <div class="my-5 h-px bg-border/70"></div>
            <div class="space-y-3.5">
              <div>
                <div class="mb-1.5 h-2 w-12 rounded-full bg-muted-foreground/50"></div>
                <div
                  class="flex h-9 w-full items-center rounded-md border border-border/70 bg-background px-3"
                >
                  <div class="h-2.5 w-2/3 rounded-full bg-foreground/15"></div>
                </div>
              </div>
              <div>
                <div class="mb-1.5 h-2 w-16 rounded-full bg-muted-foreground/50"></div>
                <div
                  class="flex h-9 w-full items-center rounded-md border border-border/70 bg-background px-3"
                >
                  <div class="h-2.5 w-1/2 rounded-full bg-foreground/15"></div>
                </div>
              </div>
            </div>
            <div class="mt-5 h-10 w-full rounded-lg bg-primary"></div>
            <div
              class="mt-4 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5"
            >
              <span
                class="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check :size="14" :stroke-width="3" />
              </span>
              <div class="space-y-1.5">
                <div class="h-2 w-20 rounded-full bg-foreground/70"></div>
                <div class="h-1.5 w-28 rounded-full bg-muted-foreground/40"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features (asymmetric bento, not 3 equal cards) -->
      <section id="features" class="scroll-mt-20 py-16 md:py-24">
        <div v-reveal class="reveal max-w-2xl">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ t('home.featuresTitle') }}
          </h2>
          <p class="mt-3 text-muted-foreground">{{ t('home.featuresSubtitle') }}</p>
        </div>
        <div class="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <article
            v-for="(f, i) in features"
            :key="i"
            v-reveal="i * 70"
            :class="[
              'reveal group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-black/5',
              f.span,
            ]"
          >
            <div
              :class="
                f.wide ? 'flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5' : 'contents'
              "
            >
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <component :is="f.icon" :size="20" :stroke-width="2" />
              </span>
              <div>
                <h3
                  class="font-semibold leading-tight"
                  :class="f.wide ? 'text-lg sm:pt-1' : 'mt-4 text-base'"
                >
                  {{ f.title }}
                </h3>
                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ f.desc }}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- How it works -->
      <section id="how" class="scroll-mt-20 py-16 md:py-24">
        <div v-reveal class="reveal max-w-2xl">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ t('home.howTitle') }}
          </h2>
          <p class="mt-3 text-muted-foreground">{{ t('home.howSubtitle') }}</p>
        </div>
        <div class="relative mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
          <div
            aria-hidden="true"
            class="absolute inset-x-0 top-7 hidden h-px bg-linear-to-r from-transparent via-border to-transparent sm:block"
          ></div>
          <div v-for="(s, i) in steps" :key="i" v-reveal="i * 100" class="reveal relative">
            <div
              class="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card text-lg font-semibold tabular-nums text-primary shadow-sm"
            >
              {{ s.n }}
            </div>
            <h3 class="mt-4 text-base font-semibold">{{ s.title }}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ s.desc }}</p>
          </div>
        </div>
      </section>

      <!-- CTA band -->
      <section class="py-12 md:py-20">
        <div
          v-reveal
          class="reveal relative overflow-hidden rounded-3xl border border-primary/25 bg-primary/6 px-6 py-12 text-center md:px-12 md:py-16"
        >
          <div
            aria-hidden="true"
            class="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          ></div>
          <h2
            class="relative mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {{ t('home.ctaBandTitle') }}
          </h2>
          <p class="relative mx-auto mt-3 max-w-xl text-muted-foreground">
            {{ t('home.ctaBandDesc') }}
          </p>
          <div class="relative mt-7 flex justify-center">
            <NuxtLink
              to="/dashboard"
              class="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              {{ t('home.cta') }}
              <ArrowRight
                :size="17"
                class="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>
          </div>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
/* Scroll/mount reveal — transform + opacity only (GPU-friendly). */
.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}
.reveal.is-in {
  opacity: 1;
  transform: none;
}

/* Perpetual, gentle ambient motion on the decorative blobs + hero mock. */
.blob {
  animation: drift 18s ease-in-out infinite;
}
.blob-a {
  animation-name: drift-a;
}
.blob-b {
  animation-name: drift-b;
}
@keyframes drift-a {
  0%,
  100% {
    transform: translate(-50%, 0) scale(1);
  }
  50% {
    transform: translate(-50%, 3%) scale(1.06);
  }
}
@keyframes drift-b {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-5%, 5%);
  }
}
.mock-card {
  animation: floaty 7s ease-in-out infinite;
}
@keyframes floaty {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .blob,
  .mock-card {
    animation: none !important;
  }
}
</style>
