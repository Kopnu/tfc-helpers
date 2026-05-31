<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { INGOT_MB } from '../lib/alloyMath'

const DEFAULT_BLOOM_CAST_IRON_MB = 144
const BLOOM_CHARCOAL = 2

const ironSources = [
  { id: 'cast-iron-ingot', mb: INGOT_MB },
  { id: 'rich-ore', mb: 48 },
  { id: 'normal-ore', mb: 36 },
  { id: 'poor-ore', mb: 24 },
  { id: 'small-ore', mb: 16 }
]

const mode = ref('bloom')
const resultAmount = ref(1)
const selectedSourceId = ref('normal-ore')
const useInventory = ref(true)
const inventory = reactive(
  ironSources.reduce((counts, source) => {
    counts[source.id] = 0
    return counts
  }, {})
)
const requiredInventory = reactive(
  ironSources.reduce((counts, source) => {
    counts[source.id] = 0
    return counts
  }, {})
)

const { t } = useI18n()

const sourceName = (source) => t(`ironworking.sources.${source.id}`, { mb: source.mb ?? '' })

const normalizeCount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

const sourceMb = (sourceId) => {
  const source = ironSources.find((item) => item.id === sourceId)
  return source?.mb ?? 0
}

const buildSimpleMaterialSummary = (requiredMb, mbPerItem) => {
  const itemCount = Math.ceil(requiredMb / mbPerItem)
  const suppliedMb = itemCount * mbPerItem

  return {
    canBuild: true,
    itemCount,
    suppliedMb,
    surplusMb: suppliedMb - requiredMb,
    portions: itemCount > 0 ? [{ sourceId: selectedSourceId.value, count: itemCount, mb: mbPerItem }] : [],
    key: `${selectedSourceId.value}:${mbPerItem}:${itemCount}`
  }
}

const emptyMaterialSummary = (requiredMb) => ({
  canBuild: false,
  itemCount: 0,
  suppliedMb: 0,
  surplusMb: -requiredMb,
  portions: [],
  key: 'empty'
})

const availableSources = computed(() =>
  ironSources
    .map((source) => ({
      sourceId: source.id,
      count: normalizeCount(inventory[source.id]),
      mb: source.mb
    }))
    .filter((source) => source.count > 0)
)

const requiredSources = computed(() =>
  ironSources.map((source) => ({
    sourceId: source.id,
    count: normalizeCount(requiredInventory[source.id]),
    mb: source.mb
  }))
)

const buildInventoryOption = (counts, sources, suppliedMb, requiredMb, canBuild = true, basePortions = []) => {
  const portions = counts
    .map((count, index) => ({
      sourceId: sources[index].sourceId,
      count,
      mb: sources[index].mb
    }))
    .filter((portion) => portion.count > 0)
  const mergedPortions = [...basePortions, ...portions].reduce((result, portion) => {
    const existing = result.find((item) => item.sourceId === portion.sourceId)
    if (existing) {
      existing.count += portion.count
      return result
    }

    result.push({ ...portion })
    return result
  }, [])

  return {
    canBuild,
    itemCount: mergedPortions.reduce((sum, portion) => sum + portion.count, 0),
    suppliedMb,
    surplusMb: suppliedMb - requiredMb,
    portions: mergedPortions,
    key: mergedPortions.map((portion) => `${portion.sourceId}:${portion.mb}:${portion.count}`).join('|')
  }
}

const addReachableState = (states, counts, maxStates) => {
  const key = counts.join(':')

  if (states.some((state) => state.join(':') === key)) {
    return
  }

  states.push(counts)
  states.sort((left, right) => left.reduce((sum, count) => sum + count, 0) - right.reduce((sum, count) => sum + count, 0))

  if (states.length > maxStates) {
    states.length = maxStates
  }
}

const findInventoryMaterialOptions = (requiredMb, maxResults = 6) => {
  if (requiredMb <= 0) {
    return [{
      canBuild: true,
      itemCount: 0,
      suppliedMb: 0,
      surplusMb: 0,
      portions: [],
      key: 'zero'
    }]
  }

  const availableById = Object.fromEntries(availableSources.value.map((source) => [source.sourceId, source]))
  const requiredPortions = requiredSources.value.filter((source) => source.count > 0)
  const requiredPortionMb = requiredPortions.reduce((sum, source) => sum + source.count * source.mb, 0)
  const requiredPortionsAreAvailable = requiredPortions.every(
    (source) => source.count <= (availableById[source.sourceId]?.count ?? 0)
  )

  if (!requiredPortionsAreAvailable || requiredPortionMb > requiredMb) {
    return [emptyMaterialSummary(requiredMb)]
  }

  const remainingMb = requiredMb - requiredPortionMb
  const sources = ironSources
    .map((source) => ({
      sourceId: source.id,
      count: normalizeCount(requiredInventory[source.id]) > 0 ? 0 : normalizeCount(inventory[source.id]),
      mb: source.mb
    }))
    .filter((source) => source.count > 0)

  if (remainingMb === 0) {
    return [buildInventoryOption([], [], requiredMb, requiredMb, true, requiredPortions)]
  }

  if (sources.length === 0) {
    return [emptyMaterialSummary(requiredMb)]
  }

  const totalAvailableMb = sources.reduce((sum, source) => sum + source.count * source.mb, 0)
  const cap = Math.min(totalAvailableMb, remainingMb)
  const maxStatesPerVolume = maxResults * 4
  const reachable = Array.from({ length: cap + 1 }, () => [])
  reachable[0] = [sources.map(() => 0)]

  sources.forEach((source, sourceIndex) => {
    for (let copy = 0; copy < source.count; copy += 1) {
      for (let volume = cap - source.mb; volume >= 0; volume -= 1) {
        const states = reachable[volume]
        const nextVolume = volume + source.mb

        states.forEach((counts) => {
          const nextCounts = [...counts]
          nextCounts[sourceIndex] += 1
          addReachableState(reachable[nextVolume], nextCounts, maxStatesPerVolume)
        })
      }
    }
  })

  const options =
    reachable[remainingMb]?.map((counts) => buildInventoryOption(counts, sources, requiredMb, requiredMb, true, requiredPortions)) ?? []

  if (options.length > 0) {
    return options
      .sort((left, right) => left.itemCount - right.itemCount)
      .slice(0, maxResults)
  }

  return [
    buildInventoryOption(
      sources.map((source) => source.count),
      sources,
      requiredPortionMb + totalAvailableMb,
      requiredMb,
      false,
      requiredPortions
    )
  ]
}

const amount = computed(() => normalizeCount(resultAmount.value))
const requiredMetalMb = computed(() => amount.value * (mode.value === 'bloom' ? DEFAULT_BLOOM_CAST_IRON_MB : INGOT_MB))
const activeSourceMb = computed(() => sourceMb(selectedSourceId.value))
const materialOptions = computed(() =>
  useInventory.value
    ? findInventoryMaterialOptions(requiredMetalMb.value)
    : [buildSimpleMaterialSummary(requiredMetalMb.value, activeSourceMb.value)]
)
const materialSummary = computed(() => materialOptions.value[0] ?? emptyMaterialSummary(requiredMetalMb.value))

const portionCount = (option, sourceId) =>
  option.portions.find((portion) => portion.sourceId === sourceId)?.count ?? 0
</script>

<template>
  <section class="toolbar">
    <div>
      <h1>{{ t('app.ironworkingTitle') }}</h1>
    </div>
  </section>

  <section class="ironworking-card">
    <div class="section-heading">
      <h2>{{ mode === 'bloom' ? t('ironworking.bloom.title') : t('ironworking.steel.title') }}</h2>
      <div class="unit-toggle ironworking-mode-toggle" :aria-label="t('ironworking.mode')">
        <button :class="{ active: mode === 'bloom' }" type="button" @click="mode = 'bloom'">
          {{ t('ironworking.bloom.title') }}
        </button>
        <button :class="{ active: mode === 'steel' }" type="button" @click="mode = 'steel'">
          {{ t('ironworking.steel.title') }}
        </button>
      </div>
    </div>

    <div class="ironworking-controls">
      <label class="field">
        <span>{{ mode === 'bloom' ? t('ironworking.bloom.amount') : t('ironworking.steel.amount') }}</span>
        <input v-model.number="resultAmount" min="1" type="number" />
      </label>

      <label v-if="!useInventory" class="field">
        <span>{{ t('ironworking.source') }}</span>
        <select v-model="selectedSourceId">
          <option v-for="source in ironSources" :key="source.id" :value="source.id">
            {{ sourceName(source) }}
          </option>
        </select>
      </label>

    </div>

    <section class="inventory-band ironworking-inventory">
      <label class="inventory-toggle">
        <input v-model="useInventory" type="checkbox" />
        <span>{{ t('inventory.useAvailable') }}</span>
      </label>

      <div v-if="useInventory" class="inventory-grid">
        <div class="inventory-row">
          <strong>{{ t('ironworking.castIron') }}</strong>
          <label v-for="source in ironSources" :key="source.id">
            <span>{{ sourceName(source) }}</span>
            <input v-model.number="inventory[source.id]" min="0" type="number" />
          </label>
        </div>
      </div>
    </section>

    <details v-if="useInventory" class="ironworking-required">
      <summary>{{ t('ironworking.required.title') }}</summary>

      <div class="inventory-grid">
        <div class="inventory-row">
          <strong>{{ t('ironworking.castIron') }}</strong>
          <label v-for="source in ironSources" :key="source.id">
            <span>{{ sourceName(source) }}</span>
            <input v-model.number="requiredInventory[source.id]" min="0" type="number" />
          </label>
        </div>
      </div>
    </details>

    <div v-if="materialOptions.length && materialSummary.canBuild" class="ironworking-options">
      <h3>{{ t('ironworking.results.variants') }}</h3>
      <div class="ironworking-options-table-wrap">
        <table class="ironworking-options-table">
          <thead>
            <tr>
              <th v-for="source in ironSources" :key="source.id">{{ sourceName(source) }}</th>
              <th>{{ t('ironworking.results.totalMb') }}</th>
              <th v-if="mode === 'steel'">{{ t('ironworking.results.flux') }}</th>
              <th>{{ t('ironworking.results.charcoal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="option in materialOptions" :key="option.key">
              <td v-for="source in ironSources" :key="source.id">
                {{ portionCount(option, source.id) || '' }}
              </td>
              <td>{{ option.suppliedMb }}</td>
              <td v-if="mode === 'steel'">{{ option.itemCount }}</td>
              <td>{{ mode === 'steel' ? option.itemCount : amount * BLOOM_CHARCOAL }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section v-if="!materialSummary.canBuild" class="messages">
    <p>{{ t('ironworking.validation.notEnoughMetal') }}</p>
  </section>
</template>
