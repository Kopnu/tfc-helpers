<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveLocale, supportedLocales } from './i18n'
import AlloyCalculatorPage from './pages/AlloyCalculatorPage.vue'
import IronworkingCalculatorPage from './pages/IronworkingCalculatorPage.vue'
import ProspectorPickPage from './pages/ProspectorPickPage.vue'

const activePage = ref('alloys')
const navPages = [
  { id: 'alloys', labelKey: 'nav.alloys' },
  { id: 'ironworking', labelKey: 'nav.ironworking' },
  { id: 'prospector-pick', labelKey: 'nav.prospectorPick' }
]
const externalLinks = [
  { id: 'anvil-helper', labelKey: 'nav.anvilHelper', url: 'https://iagocq.github.io/tfc-anvil/' }
]

const { t, locale } = useI18n()
const setLocale = (nextLocale) => {
  if (!supportedLocales.includes(nextLocale)) {
    return
  }

  locale.value = nextLocale
  saveLocale(nextLocale)
}
const setActivePage = (pageId) => {
  activePage.value = pageId
}
const activePageConfig = computed(() => navPages.find((page) => page.id === activePage.value) ?? navPages[0])

watch(
  [locale, activePageConfig],
  ([nextLocale]) => {
    const toolName = t(activePageConfig.value.labelKey)

    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLocale
      document.title = `TFC Helpers - ${toolName}`
    }
  },
  { immediate: true }
)

watch(
  activePage,
  (pageId) => {
    if (!navPages.some((page) => page.id === pageId)) {
      activePage.value = navPages[0].id
    }
  }
)
</script>

<template>
  <main class="app-shell">
    <nav class="app-nav" :aria-label="t('nav.label')">
      <p class="nav-title">{{ t('nav.title') }}</p>

      <div class="nav-center">
        <button
          v-for="page in navPages"
          :key="page.id"
          class="nav-calculator"
          :class="{ active: activePage === page.id }"
          type="button"
          :aria-current="activePage === page.id ? 'page' : undefined"
          @click="setActivePage(page.id)"
        >
          {{ t(page.labelKey) }}
        </button>
        <a
          v-for="link in externalLinks"
          :key="link.id"
          class="nav-calculator nav-link"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t(link.labelKey) }}
        </a>
      </div>

      <div class="language-switch" aria-label="Language">
        <button
          v-for="language in supportedLocales"
          :key="language"
          class="language-button"
          :class="{ active: locale === language }"
          type="button"
          :aria-pressed="locale === language"
          @click="setLocale(language)"
        >
          {{ language.toUpperCase() }}
        </button>
      </div>
    </nav>

    <AlloyCalculatorPage v-if="activePage === 'alloys'" />
    <IronworkingCalculatorPage v-else-if="activePage === 'ironworking'" />
    <ProspectorPickPage v-else />

    <footer class="app-footer">
      {{ t('app.copyright') }}
    </footer>
  </main>
</template>
