<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AlloyRecipeTree from '../components/AlloyRecipeTree.vue'
import { alloys, findAlloyRecipeForIngredient } from '../data/alloys'
import {
  DISPLAY_INVENTORY_PORTION_SIZES,
  INVENTORY_PORTION_SIZES,
  INGOT_MB,
  findClosestVolumeIndex,
  findCombinations,
  findValidRecipe,
  isPercentInRange,
  percentOf,
  possibleVolumes
} from '../lib/alloyMath'
import { readStoredValue, writeStoredValue } from '../lib/persistentState'

const inventoryStorageKey = 'tfc-helpers:alloy-inventory'
const useInventoryStorageKey = 'tfc-helpers:alloy-use-inventory'

const normalizeInventoryCount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

const buildInventoryState = (rawInventory = {}) => {
  const inventoryState = {}
  const ingredientIds = new Set(alloys.flatMap((alloy) => alloy.ingredients.map((ingredient) => ingredient.id)))

  ingredientIds.forEach((ingredientId) => {
    inventoryState[ingredientId] = {}

    INVENTORY_PORTION_SIZES.forEach((size) => {
      inventoryState[ingredientId][size] = normalizeInventoryCount(rawInventory?.[ingredientId]?.[size])
    })
  })

  return inventoryState
}

const selectedAlloyId = ref(alloys[0]?.id ?? '')
const resultUnit = ref('ingots')
const resultAmount = ref(1)
const useInventory = ref(readStoredValue(useInventoryStorageKey, false) === true)
const selectedVolumes = ref([])
const autoIngredients = ref([])
const inventory = reactive(buildInventoryState(readStoredValue(inventoryStorageKey, {})))
const useInventoryForIngredient = reactive({})
const expandedCompositions = reactive({})

const { t } = useI18n()
const alloyName = (alloy) => t(`alloys.${alloy.id}`)
const ingredientName = (ingredient) => t(`ingredients.${ingredient.id}`)
const portionLabel = (size) => (size === INGOT_MB ? t('inventory.ingotPortion') : `${size} mB`)
const isAlloyIngredient = (ingredient) => Boolean(findAlloyRecipeForIngredient(ingredient.id))
const compositionKey = (state) => `${selectedAlloy.value.id}:${state.index}:${state.ingredient.id}`
const isCompositionExpanded = (state) => Boolean(expandedCompositions[compositionKey(state)])

const isCompositionToggleIgnored = (event) =>
  event.target instanceof Element &&
  Boolean(event.target.closest('input, button, select, textarea, a, label, details, summary, .alloy-breakdown'))

const toggleCompositionFromRow = (state, event) => {
  if (!isAlloyIngredient(state.ingredient) || isCompositionToggleIgnored(event)) {
    return
  }

  const key = compositionKey(state)
  expandedCompositions[key] = !expandedCompositions[key]
}

const selectedAlloy = computed(() => alloys.find((alloy) => alloy.id === selectedAlloyId.value) ?? alloys[0])
const selectedAlloyName = computed(() => alloyName(selectedAlloy.value))

const totalMb = computed(() => {
  const amount = Number(resultAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  return Math.floor(resultUnit.value === 'ingots' ? amount * INGOT_MB : amount)
})

const selectedSum = computed(() => selectedVolumes.value.reduce((sum, volume) => sum + Number(volume || 0), 0))

const difference = computed(() => totalMb.value - selectedSum.value)

const ensureInventoryShape = () => {
  selectedAlloy.value.ingredients.forEach((ingredient) => {
    if (!inventory[ingredient.id]) {
      inventory[ingredient.id] = {}
    }

    INVENTORY_PORTION_SIZES.forEach((size) => {
      if (inventory[ingredient.id][size] === undefined) {
        inventory[ingredient.id][size] = 0
        return
      }

      inventory[ingredient.id][size] = normalizeInventoryCount(inventory[ingredient.id][size])
    })

    if (useInventoryForIngredient[ingredient.id] === undefined) {
      useInventoryForIngredient[ingredient.id] = true
    }
  })
}

const usesInventoryForIngredient = (ingredient) =>
  useInventory.value && useInventoryForIngredient[ingredient.id] !== false

const limitsForIngredient = (ingredient) => {
  if (!usesInventoryForIngredient(ingredient)) {
    return {}
  }

  return INVENTORY_PORTION_SIZES.reduce((limits, size) => {
    limits[size] = Number(inventory[ingredient.id]?.[size] ?? 0)
    return limits
  }, {})
}

const ingredientStates = computed(() =>
  selectedAlloy.value.ingredients.map((ingredient, index) => {
    const volumes = possibleVolumes(totalMb.value, limitsForIngredient(ingredient))
    const selectedVolume = Number(selectedVolumes.value[index] ?? 0)
    const sliderIndex = findClosestVolumeIndex(volumes, selectedVolume)
    const percent = percentOf(selectedVolume, totalMb.value)
    const combinations = findCombinations(selectedVolume, limitsForIngredient(ingredient), 5)

    return {
      ingredient,
      index,
      isAuto: Boolean(autoIngredients.value[index]),
      volumes,
      sliderIndex,
      selectedVolume,
      percent,
      inRange: isPercentInRange(percent, ingredient),
      combinations,
      canBuild: selectedVolume === 0 || combinations.length > 0
    }
  })
)

const invalidReasons = computed(() => {
  const reasons = []

  if (totalMb.value <= 0) {
    reasons.push(t('validation.amountGreaterThanZero'))
  }

  if (difference.value !== 0) {
    const direction = difference.value > 0 ? t('validation.missing') : t('validation.extra')
    reasons.push(t('validation.sumMismatch', { direction, amount: Math.abs(difference.value) }))
  }

  ingredientStates.value.forEach((state) => {
    const name = ingredientName(state.ingredient)

    if (!state.inRange) {
      reasons.push(
        t('validation.percentOutOfRange', {
          name,
          percent: state.percent.toFixed(1),
          min: state.ingredient.min,
          max: state.ingredient.max
        })
      )
    }

    if (!state.canBuild) {
      reasons.push(t('validation.cannotBuildVolume', { name }))
    }
  })

  return reasons
})

const isRecipeValid = computed(() => invalidReasons.value.length === 0)

const ensureAutoShape = () => {
  autoIngredients.value = selectedAlloy.value.ingredients.map((_, index) => Boolean(autoIngredients.value[index]))
}

const applyRecipe = (selection) => {
  selectedVolumes.value = selectedAlloy.value.ingredients.map((_, index) => selection[index] ?? 0)
}

const applyAutoRecipe = () => {
  const selection = findValidRecipe(selectedAlloy.value, totalMb.value, limitsForIngredient)
  if (selection) {
    applyRecipe(selection)
    return true
  }

  return false
}

const resetToRecipeMidpoints = () => {
  selectedVolumes.value = selectedAlloy.value.ingredients.map((ingredient) => {
    const target = (totalMb.value * (ingredient.min + ingredient.max)) / 200
    const volumes = possibleVolumes(totalMb.value, limitsForIngredient(ingredient))
    return volumes[findClosestVolumeIndex(volumes, target)] ?? 0
  })
}

const findAutoSelection = (baseSelection) => {
  const autoIndexes = selectedAlloy.value.ingredients
    .map((_, index) => index)
    .filter((index) => autoIngredients.value[index])

  if (autoIndexes.length === 0 || totalMb.value <= 0) {
    return null
  }

  const manualSum = selectedAlloy.value.ingredients.reduce((sum, _, index) => {
    return autoIngredients.value[index] ? sum : sum + Number(baseSelection[index] ?? 0)
  }, 0)
  const targetAutoSum = totalMb.value - manualSum

  if (targetAutoSum < 0) {
    return null
  }

  const options = autoIndexes.map((ingredientIndex) => {
    const ingredient = selectedAlloy.value.ingredients[ingredientIndex]
    const minVolume = Math.ceil((totalMb.value * ingredient.min) / 100)
    const maxVolume = Math.floor((totalMb.value * ingredient.max) / 100)
    const current = Number(baseSelection[ingredientIndex] ?? 0)
    const midpoint = (totalMb.value * (ingredient.min + ingredient.max)) / 200

    return {
      ingredientIndex,
      values: possibleVolumes(totalMb.value, limitsForIngredient(ingredient))
        .filter((volume) => volume >= minVolume && volume <= maxVolume)
        .sort((left, right) => {
          const leftScore = Math.abs(left - current) + Math.abs(left - midpoint)
          const rightScore = Math.abs(right - current) + Math.abs(right - midpoint)
          return leftScore - rightScore
        })
    }
  })

  if (options.some((option) => option.values.length === 0)) {
    return null
  }

  const minRemaining = Array(options.length + 1).fill(0)
  const maxRemaining = Array(options.length + 1).fill(0)

  for (let index = options.length - 1; index >= 0; index -= 1) {
    minRemaining[index] = minRemaining[index + 1] + Math.min(...options[index].values)
    maxRemaining[index] = maxRemaining[index + 1] + Math.max(...options[index].values)
  }

  const nextSelection = [...baseSelection]

  const walk = (index, sum) => {
    if (index === options.length) {
      return sum === targetAutoSum
    }

    for (const volume of options[index].values) {
      const nextSum = sum + volume
      if (
        nextSum + minRemaining[index + 1] <= targetAutoSum &&
        nextSum + maxRemaining[index + 1] >= targetAutoSum
      ) {
        nextSelection[options[index].ingredientIndex] = volume
        if (walk(index + 1, nextSum)) {
          return true
        }
      }
    }

    return false
  }

  return walk(0, 0) ? nextSelection : null
}

const applyAutoIngredients = (baseSelection = selectedVolumes.value) => {
  const selection = findAutoSelection(baseSelection)
  if (!selection) {
    return false
  }

  selectedVolumes.value = selection
  return true
}

const refreshSelection = () => {
  ensureInventoryShape()
  ensureAutoShape()
  if (!applyAutoRecipe()) {
    resetToRecipeMidpoints()
  }
  applyAutoIngredients()
}

const setVolumeFromSlider = (state, rawIndex) => {
  if (state.isAuto) {
    return
  }

  const nextIndex = Number(rawIndex)
  const nextSelection = [...selectedVolumes.value]
  nextSelection[state.index] = state.volumes[nextIndex] ?? 0
  selectedVolumes.value = nextSelection
  applyAutoIngredients(nextSelection)
}

const toggleAutoIngredient = (state, checked) => {
  autoIngredients.value[state.index] = checked
  if (checked) {
    applyAutoIngredients()
  }
}

const toggleIngredientInventory = (ingredient, checked) => {
  useInventoryForIngredient[ingredient.id] = checked
  refreshSelection()
}

watch([selectedAlloyId, totalMb], refreshSelection, { immediate: true })
watch(useInventory, (nextUseInventory) => {
  writeStoredValue(useInventoryStorageKey, nextUseInventory)
  if (nextUseInventory) {
    selectedAlloy.value.ingredients.forEach((ingredient) => {
      useInventoryForIngredient[ingredient.id] = true
    })
  }
  refreshSelection()
}, { flush: 'sync' })

watch(inventory, (nextInventory) => {
  writeStoredValue(inventoryStorageKey, nextInventory)
}, { deep: true, flush: 'sync' })

const inventorySignature = computed(() =>
  selectedAlloy.value.ingredients
    .map((ingredient) => INVENTORY_PORTION_SIZES.map((size) => inventory[ingredient.id]?.[size] ?? 0).join(':'))
    .join('|')
)

watch(inventorySignature, () => {
  if (useInventory.value) {
    refreshSelection()
  }
})
</script>

<template>
  <section class="toolbar">
    <div>
      <h1>{{ t('app.title') }}</h1>
    </div>
  </section>

  <section class="controls-band">
    <label class="field alloy-picker">
      <span>{{ t('controls.alloy') }}</span>
      <select v-model="selectedAlloyId">
        <option v-for="alloy in alloys" :key="alloy.id" :value="alloy.id">
          {{ alloyName(alloy) }}
        </option>
      </select>
    </label>

    <div class="field">
      <span>{{ t('controls.result') }}</span>
      <div class="unit-toggle" :aria-label="t('controls.resultUnitLabel')">
        <button :class="{ active: resultUnit === 'ingots' }" type="button" @click="resultUnit = 'ingots'">
          {{ t('controls.ingots') }}
        </button>
        <button :class="{ active: resultUnit === 'mb' }" type="button" @click="resultUnit = 'mb'">
          mB
        </button>
      </div>
    </div>

    <label class="field amount-field">
      <span>{{ t('controls.amount') }}</span>
      <input v-model.number="resultAmount" min="1" type="number" />
    </label>

    <div class="result-meter">
      <span>{{ t('controls.total') }}</span>
      <strong>{{ totalMb }} mB</strong>
    </div>
  </section>

  <section class="recipe-band">
    <div class="section-heading">
      <h2>{{ selectedAlloyName }}</h2>
      <button type="button" @click="applyAutoRecipe">{{ t('recipe.findValid') }}</button>
    </div>

    <div class="recipe-ranges">
      <span v-for="ingredient in selectedAlloy.ingredients" :key="ingredient.id">
        {{ ingredientName(ingredient) }} {{ ingredient.min }}-{{ ingredient.max }}%
      </span>
    </div>
  </section>

  <section class="inventory-band">
    <label class="inventory-toggle">
      <input v-model="useInventory" type="checkbox" />
      <span>{{ t('inventory.useAvailable') }}</span>
    </label>

    <div v-if="useInventory" class="inventory-grid">
      <div v-for="ingredient in selectedAlloy.ingredients" :key="ingredient.id" class="inventory-row">
        <label class="inventory-ingredient-toggle">
          <input
            type="checkbox"
            :checked="useInventoryForIngredient[ingredient.id] !== false"
            @change="toggleIngredientInventory(ingredient, $event.target.checked)"
          />
          <strong>{{ ingredientName(ingredient) }}</strong>
        </label>
        <label v-for="size in DISPLAY_INVENTORY_PORTION_SIZES" :key="size">
          <span>{{ portionLabel(size) }}</span>
          <input v-model.number="inventory[ingredient.id][size]" min="0" type="number" />
        </label>
      </div>
    </div>
  </section>

  <section class="mix-panel">
    <div class="mix-summary">
      <div class="status-pill" :class="{ valid: isRecipeValid }">
        {{ isRecipeValid ? t('recipe.valid') : t('recipe.needsFix') }}
      </div>
      <div>
        <span>{{ t('recipe.selected') }}</span>
        <strong>{{ selectedSum }} mB</strong>
      </div>
      <div>
        <span>{{ t('recipe.difference') }}</span>
        <strong :class="{ danger: difference !== 0 }">{{ difference }} mB</strong>
      </div>
    </div>

    <article
      v-for="state in ingredientStates"
      :key="state.ingredient.id"
      class="ingredient-row"
      :class="{
        invalid: !state.inRange || !state.canBuild,
        expandable: isAlloyIngredient(state.ingredient),
        expanded: isCompositionExpanded(state)
      }"
      :role="isAlloyIngredient(state.ingredient) ? 'button' : null"
      :tabindex="isAlloyIngredient(state.ingredient) ? 0 : null"
      :aria-expanded="isAlloyIngredient(state.ingredient) ? isCompositionExpanded(state) : null"
      @click="toggleCompositionFromRow(state, $event)"
      @keydown.enter="toggleCompositionFromRow(state, $event)"
      @keydown.space.prevent="toggleCompositionFromRow(state, $event)"
    >
      <div class="ingredient-main">
        <div class="ingredient-title">
          <h3>
            <span v-if="isAlloyIngredient(state.ingredient)" class="composition-caret" aria-hidden="true">
              {{ isCompositionExpanded(state) ? 'v' : '>' }}
            </span>
            {{ ingredientName(state.ingredient) }}
          </h3>
          <span>{{ state.ingredient.min }}-{{ state.ingredient.max }}%</span>
        </div>

        <div class="amount-readout">
          <strong>{{ state.selectedVolume }} mB</strong>
          <span>{{ state.percent.toFixed(1) }}%</span>
        </div>

        <label class="auto-toggle">
          <input
            type="checkbox"
            :checked="state.isAuto"
            @change="toggleAutoIngredient(state, $event.target.checked)"
          />
          <span>{{ t('recipe.auto') }}</span>
        </label>
      </div>

      <input
        class="volume-slider"
        :class="{ automatic: state.isAuto }"
        type="range"
        min="0"
        :max="Math.max(state.volumes.length - 1, 0)"
        :value="state.sliderIndex"
        :disabled="state.isAuto"
        @input="setVolumeFromSlider(state, $event.target.value)"
      />

      <div class="slider-limits">
        <span>{{ state.volumes[0] ?? 0 }} mB</span>
        <span>{{ state.volumes[state.volumes.length - 1] ?? 0 }} mB</span>
      </div>

      <div class="combos">
        <span class="combo-label">{{ t('recipe.portions') }}</span>
        <span v-if="state.combinations.length === 0" class="empty-combo">
          {{ t('recipe.noMatchingCombinations') }}
        </span>
        <div v-for="combo in state.combinations" :key="combo.label" class="combo-chip">
          <span
            v-for="size in Object.keys(combo.counts).map(Number).sort((left, right) => right - left).filter((size) => combo.counts[size] > 0)"
            :key="size"
          >
            {{ size }} mB x {{ combo.counts[size] }}
          </span>
          <span v-if="combo.totalPieces === 0">0 mB</span>
        </div>
      </div>

      <div v-if="isAlloyIngredient(state.ingredient) && isCompositionExpanded(state)" class="alloy-breakdown">
        <AlloyRecipeTree :ingredient-id="state.ingredient.id" :volume="state.selectedVolume" />
      </div>
    </article>
  </section>

  <section v-if="invalidReasons.length" class="messages">
    <p v-for="reason in invalidReasons" :key="reason">{{ reason }}</p>
  </section>
</template>
