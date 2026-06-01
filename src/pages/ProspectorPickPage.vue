<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const settings = reactive({
  sizeX: 25,
  sizeY: 25,
  sizeZ: 25
})
const sampleResults = ['traces', 'small', 'medium', 'large', 'veryLarge']
const draftSample = reactive({
  x: null,
  y: null,
  z: null,
  result: 'small'
})
const samples = ref([])
const showPositionHelp = ref(false)

const normalizeInteger = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

const normalizeSize = (value) => Math.max(1, normalizeInteger(value) ?? 1)

const normalizeSetting = (key) => {
  settings[key] = normalizeSize(settings[key])
}

const normalizeSample = (sample, key) => {
  sample[key] = normalizeInteger(sample[key]) ?? 0
}

const normalizeSampleResult = (sample) => {
  if (!sampleResults.includes(sample.result)) {
    sample.result = sampleResults[0]
  }
}

const canAddSample = computed(() =>
  [draftSample.x, draftSample.y, draftSample.z].every((coordinate) => normalizeInteger(coordinate) !== null)
)

const dimensionBounds = (center, size) => {
  const safeSize = normalizeSize(size)
  const before = Math.floor((safeSize - 1) / 2)
  const min = center - before

  return {
    min,
    max: min + safeSize - 1
  }
}

const scanBoundsForSample = (sample) => ({
  x: dimensionBounds(normalizeInteger(sample.x) ?? 0, settings.sizeX),
  y: dimensionBounds(normalizeInteger(sample.y) ?? 0, settings.sizeY),
  z: dimensionBounds(normalizeInteger(sample.z) ?? 0, settings.sizeZ)
})

const intersectBounds = (left, right) => ({
  x: {
    min: Math.max(left.x.min, right.x.min),
    max: Math.min(left.x.max, right.x.max)
  },
  y: {
    min: Math.max(left.y.min, right.y.min),
    max: Math.min(left.y.max, right.y.max)
  },
  z: {
    min: Math.max(left.z.min, right.z.min),
    max: Math.min(left.z.max, right.z.max)
  }
})

const hasValidBounds = (bounds) =>
  bounds.x.min <= bounds.x.max && bounds.y.min <= bounds.y.max && bounds.z.min <= bounds.z.max

const blockCount = (bounds) =>
  (bounds.x.max - bounds.x.min + 1) * (bounds.y.max - bounds.y.min + 1) * (bounds.z.max - bounds.z.min + 1)

const probableArea = computed(() => {
  if (samples.value.length === 0) {
    return null
  }

  const bounds = samples.value
    .map(scanBoundsForSample)
    .reduce((current, nextBounds) => intersectBounds(current, nextBounds))

  return {
    bounds,
    isValid: hasValidBounds(bounds),
    blockCount: hasValidBounds(bounds) ? blockCount(bounds) : 0
  }
})

const addSample = () => {
  if (!canAddSample.value) {
    return
  }

  samples.value.unshift({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${samples.value.length}`,
    x: normalizeInteger(draftSample.x),
    y: normalizeInteger(draftSample.y),
    z: normalizeInteger(draftSample.z),
    result: draftSample.result
  })

  draftSample.x = null
  draftSample.y = null
  draftSample.z = null
}

const removeSample = (sampleId) => {
  samples.value = samples.value.filter((sample) => sample.id !== sampleId)
}

const resetSamples = () => {
  samples.value = []
}
</script>

<template>
  <section class="toolbar">
    <div>
      <h1>{{ t('app.prospectorPickTitle') }}</h1>
    </div>
  </section>

  <details class="prospector-card prospector-settings">
    <summary>{{ t('prospector.settings.title') }}</summary>

    <div class="prospector-settings-grid">
      <label class="field">
        <span>{{ t('prospector.settings.sizeX') }}</span>
        <input v-model.number="settings.sizeX" min="1" type="number" @change="normalizeSetting('sizeX')" />
      </label>
      <label class="field">
        <span>{{ t('prospector.settings.sizeY') }}</span>
        <input v-model.number="settings.sizeY" min="1" type="number" @change="normalizeSetting('sizeY')" />
      </label>
      <label class="field">
        <span>{{ t('prospector.settings.sizeZ') }}</span>
        <input v-model.number="settings.sizeZ" min="1" type="number" @change="normalizeSetting('sizeZ')" />
      </label>
    </div>
  </details>

  <section class="prospector-card">
    <div class="section-heading">
      <h2>{{ t('prospector.addSample.title') }}</h2>
      <button
        class="help-button"
        type="button"
        :aria-label="t('prospector.addSample.helpButton')"
        :aria-pressed="showPositionHelp"
        @click="showPositionHelp = !showPositionHelp"
      >
        ?
      </button>
    </div>

    <div v-if="showPositionHelp" class="prospector-help">
      <p>{{ t('prospector.addSample.helpLine1') }}</p>
      <p>{{ t('prospector.addSample.helpLine2') }}</p>
    </div>

    <form class="sample-form" @submit.prevent="addSample">
      <label class="field">
        <span>X</span>
        <input v-model.number="draftSample.x" type="number" />
      </label>
      <label class="field">
        <span>Y</span>
        <input v-model.number="draftSample.y" type="number" />
      </label>
      <label class="field">
        <span>Z</span>
        <input v-model.number="draftSample.z" type="number" />
      </label>
      <label class="field">
        <span>{{ t('prospector.sampleResult.label') }}</span>
        <select v-model="draftSample.result">
          <option v-for="result in sampleResults" :key="result" :value="result">
            {{ t(`prospector.sampleResult.options.${result}`) }}
          </option>
        </select>
      </label>
      <button type="submit" :disabled="!canAddSample">{{ t('prospector.addSample.add') }}</button>
    </form>
  </section>

  <section class="prospector-card">
    <div class="section-heading">
      <h2>{{ t('prospector.probableArea.title') }}</h2>
      <button class="secondary-button" type="button" :disabled="samples.length === 0" @click="resetSamples">
        {{ t('prospector.reset') }}
      </button>
    </div>

    <p v-if="samples.length === 0" class="muted-text">{{ t('prospector.probableArea.empty') }}</p>
    <p v-else-if="!probableArea.isValid" class="danger">
      {{ t('prospector.probableArea.noOverlap') }}
    </p>
    <div v-else class="probable-area-grid">
      <div>
        <span>X</span>
        <strong>{{ probableArea.bounds.x.min }} ... {{ probableArea.bounds.x.max }}</strong>
      </div>
      <div>
        <span>Y</span>
        <strong>{{ probableArea.bounds.y.min }} ... {{ probableArea.bounds.y.max }}</strong>
      </div>
      <div>
        <span>Z</span>
        <strong>{{ probableArea.bounds.z.min }} ... {{ probableArea.bounds.z.max }}</strong>
      </div>
      <div>
        <span>{{ t('prospector.probableArea.blocks') }}</span>
        <strong>{{ probableArea.blockCount }}</strong>
      </div>
    </div>
  </section>

  <section class="prospector-card">
    <div class="section-heading">
      <h2>{{ t('prospector.history.title') }}</h2>
    </div>

    <p v-if="samples.length === 0" class="muted-text">{{ t('prospector.history.empty') }}</p>
    <div v-else class="samples-table-wrap">
      <table class="samples-table">
        <thead>
          <tr>
            <th>{{ t('prospector.history.number') }}</th>
            <th>X</th>
            <th>Y</th>
            <th>Z</th>
            <th>{{ t('prospector.sampleResult.label') }}</th>
            <th>{{ t('prospector.history.scanArea') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(sample, index) in samples" :key="sample.id">
            <td>{{ samples.length - index }}</td>
            <td>
              <input v-model.number="sample.x" type="number" @change="normalizeSample(sample, 'x')" />
            </td>
            <td>
              <input v-model.number="sample.y" type="number" @change="normalizeSample(sample, 'y')" />
            </td>
            <td>
              <input v-model.number="sample.z" type="number" @change="normalizeSample(sample, 'z')" />
            </td>
            <td>
              <select v-model="sample.result" @change="normalizeSampleResult(sample)">
                <option v-for="result in sampleResults" :key="result" :value="result">
                  {{ t(`prospector.sampleResult.options.${result}`) }}
                </option>
              </select>
            </td>
            <td class="scan-cell">
              X {{ scanBoundsForSample(sample).x.min }}...{{ scanBoundsForSample(sample).x.max }},
              Y {{ scanBoundsForSample(sample).y.min }}...{{ scanBoundsForSample(sample).y.max }},
              Z {{ scanBoundsForSample(sample).z.min }}...{{ scanBoundsForSample(sample).z.max }}
            </td>
            <td>
              <button class="secondary-button" type="button" @click="removeSample(sample.id)">
                {{ t('prospector.history.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
