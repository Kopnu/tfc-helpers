<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { findAlloyRecipeForIngredient } from '../data/alloys'
import { findValidRecipe } from '../lib/alloyMath'

defineOptions({
  name: 'AlloyRecipeTree'
})

const props = defineProps({
  ingredientId: {
    type: String,
    required: true
  },
  volume: {
    type: Number,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  trail: {
    type: Array,
    default: () => []
  }
})

const { t } = useI18n()

const ingredientName = (ingredient) => t(`ingredients.${ingredient.id}`)
const recipe = computed(() => findAlloyRecipeForIngredient(props.ingredientId))
const safeVolume = computed(() => Math.max(0, Number(props.volume) || 0))
const nextTrail = computed(() => (recipe.value ? [...props.trail, recipe.value.id] : props.trail))

const formatVolume = (volume) => {
  const rounded = Math.round(Number(volume || 0) * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} mB`
}

const midpointSelection = computed(() => {
  if (!recipe.value) {
    return []
  }

  const weights = recipe.value.ingredients.map((ingredient) => (ingredient.min + ingredient.max) / 2)
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

  if (weightSum <= 0) {
    return recipe.value.ingredients.map(() => 0)
  }

  let assigned = 0
  return recipe.value.ingredients.map((_, index) => {
    if (index === recipe.value.ingredients.length - 1) {
      return Math.max(0, safeVolume.value - assigned)
    }

    const volume = (safeVolume.value * weights[index]) / weightSum
    assigned += volume
    return volume
  })
})

const exactSelection = computed(() => {
  if (!recipe.value || safeVolume.value <= 0 || !Number.isInteger(safeVolume.value)) {
    return null
  }

  return findValidRecipe(recipe.value, safeVolume.value, () => ({}))
})

const usesApproximation = computed(() => !exactSelection.value)

const ingredientRows = computed(() => {
  if (!recipe.value || props.trail.includes(recipe.value.id)) {
    return []
  }

  const selection = exactSelection.value ?? midpointSelection.value

  return recipe.value.ingredients.map((ingredient, index) => {
    const childRecipe = findAlloyRecipeForIngredient(ingredient.id)

    return {
      ingredient,
      recipe: childRecipe,
      isCycle: childRecipe ? nextTrail.value.includes(childRecipe.id) : false,
      volume: selection[index] ?? 0
    }
  })
})
</script>

<template>
  <ul v-if="ingredientRows.length" class="recipe-tree" :class="{ nested: depth > 0 }">
    <li v-for="row in ingredientRows" :key="row.ingredient.id" class="recipe-tree-item">
      <details v-if="row.recipe && !row.isCycle" class="recipe-tree-branch">
        <summary class="recipe-tree-node">
          <span class="recipe-tree-name">{{ ingredientName(row.ingredient) }}</span>
          <span class="recipe-tree-meta">
            <span class="recipe-tree-amount">
              {{ usesApproximation ? '~' : '' }}{{ formatVolume(row.volume) }}
            </span>
            <span class="recipe-tree-range">{{ row.ingredient.min }}-{{ row.ingredient.max }}%</span>
          </span>
        </summary>
        <AlloyRecipeTree
          :ingredient-id="row.ingredient.id"
          :volume="row.volume"
          :depth="depth + 1"
          :trail="nextTrail"
        />
      </details>

      <div v-else class="recipe-tree-node">
        <span class="recipe-tree-name">{{ ingredientName(row.ingredient) }}</span>
        <span class="recipe-tree-meta">
          <span class="recipe-tree-amount">
            {{ usesApproximation ? '~' : '' }}{{ formatVolume(row.volume) }}
          </span>
          <span class="recipe-tree-range">{{ row.ingredient.min }}-{{ row.ingredient.max }}%</span>
        </span>
      </div>
    </li>
  </ul>
</template>
