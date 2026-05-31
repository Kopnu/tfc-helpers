export const INGOT_MB = 144
export const PORTION_SIZES = [16, 24, 36, 48]
export const INVENTORY_PORTION_SIZES = [...PORTION_SIZES, INGOT_MB]
export const DISPLAY_PORTION_SIZES = [...PORTION_SIZES].sort((a, b) => b - a)
export const DISPLAY_INVENTORY_PORTION_SIZES = [...INVENTORY_PORTION_SIZES].sort((a, b) => b - a)

const hasPositiveIngotLimit = (rawLimits) =>
  Object.prototype.hasOwnProperty.call(rawLimits ?? {}, INGOT_MB) && Number(rawLimits?.[INGOT_MB]) > 0

const activePortionSizes = (rawLimits) =>
  hasPositiveIngotLimit(rawLimits) ? INVENTORY_PORTION_SIZES : PORTION_SIZES

const displayPortionSizes = (rawLimits) => [...activePortionSizes(rawLimits)].sort((a, b) => b - a)

const normalizeLimit = (value, maxByVolume) => {
  if (value === Infinity) {
    return Infinity
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.min(Math.floor(parsed), maxByVolume)
}

export function buildLimits(rawLimits, maxMb) {
  return activePortionSizes(rawLimits).reduce((limits, size) => {
    const maxByVolume = Math.floor(maxMb / size)
    limits[size] = normalizeLimit(rawLimits?.[size] ?? Infinity, maxByVolume)
    return limits
  }, {})
}

export function possibleVolumes(maxMb, rawLimits) {
  const safeMax = Math.max(0, Math.floor(maxMb))
  const limits = buildLimits(rawLimits, safeMax)
  const reachable = Array(safeMax + 1).fill(false)
  reachable[0] = true

  activePortionSizes(rawLimits).forEach((size) => {
    const limit = limits[size]

    if (limit === Infinity) {
      for (let volume = size; volume <= safeMax; volume += 1) {
        reachable[volume] = reachable[volume] || reachable[volume - size]
      }
      return
    }

    for (let copy = 0; copy < limit; copy += 1) {
      for (let volume = safeMax; volume >= size; volume -= 1) {
        reachable[volume] = reachable[volume] || reachable[volume - size]
      }
    }
  })

  return reachable.reduce((volumes, canBuild, volume) => {
    if (canBuild) {
      volumes.push(volume)
    }
    return volumes
  }, [])
}

export function findClosestVolumeIndex(volumes, target) {
  if (!volumes.length) {
    return 0
  }

  let bestIndex = 0
  let bestDistance = Math.abs(volumes[0] - target)

  for (let index = 1; index < volumes.length; index += 1) {
    const distance = Math.abs(volumes[index] - target)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

export function formatCombination(counts) {
  return Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a)
    .filter((size) => counts[size] > 0)
    .map((size) => `${size} mB x ${counts[size]}`)
    .join(' + ')
}

export function findCombinations(targetMb, rawLimits, maxResults = 6) {
  const target = Math.max(0, Math.floor(targetMb))
  const limits = buildLimits(rawLimits, target)
  const sizes = displayPortionSizes(rawLimits)
  const results = []

  const walk = (sizeIndex, remaining, counts) => {
    if (results.length >= maxResults) {
      return
    }

    if (sizeIndex === sizes.length) {
      if (remaining === 0) {
        const totalPieces = sizes.reduce((sum, size) => sum + counts[size], 0)
        results.push({
          counts: { ...counts },
          totalPieces,
          label: totalPieces === 0 ? '0 mB' : formatCombination(counts)
        })
      }
      return
    }

    const size = sizes[sizeIndex]
    const maxCountByVolume = Math.floor(remaining / size)
    const maxCount = Math.min(
      maxCountByVolume,
      limits[size] === Infinity ? maxCountByVolume : limits[size]
    )

    for (let count = maxCount; count >= 0; count -= 1) {
      counts[size] = count
      walk(sizeIndex + 1, remaining - count * size, counts)
    }

    counts[size] = 0
  }

  walk(
    0,
    target,
    sizes.reduce((counts, size) => {
      counts[size] = 0
      return counts
    }, {})
  )

  return results.sort((left, right) => left.totalPieces - right.totalPieces)
}

export function percentOf(part, total) {
  if (total <= 0) {
    return 0
  }

  return (part / total) * 100
}

export function isPercentInRange(percent, ingredient) {
  return percent >= ingredient.min && percent <= ingredient.max
}

export function findValidRecipe(alloy, totalMb, getLimitsForIngredient) {
  if (!alloy || totalMb <= 0) {
    return null
  }

  const options = alloy.ingredients.map((ingredient) => {
    const minVolume = Math.ceil((totalMb * ingredient.min) / 100)
    const maxVolume = Math.floor((totalMb * ingredient.max) / 100)
    const midpoint = (totalMb * (ingredient.min + ingredient.max)) / 200

    return possibleVolumes(totalMb, getLimitsForIngredient(ingredient))
      .filter((volume) => volume >= minVolume && volume <= maxVolume)
      .sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint))
  })

  if (options.some((values) => values.length === 0)) {
    return null
  }

  const minRemaining = Array(options.length + 1).fill(0)
  const maxRemaining = Array(options.length + 1).fill(0)

  for (let index = options.length - 1; index >= 0; index -= 1) {
    minRemaining[index] = minRemaining[index + 1] + Math.min(...options[index])
    maxRemaining[index] = maxRemaining[index + 1] + Math.max(...options[index])
  }

  const selection = []

  const walk = (index, sum) => {
    if (index === options.length) {
      return sum === totalMb
    }

    for (const volume of options[index]) {
      const nextSum = sum + volume
      if (
        nextSum + minRemaining[index + 1] <= totalMb &&
        nextSum + maxRemaining[index + 1] >= totalMb
      ) {
        selection[index] = volume
        if (walk(index + 1, nextSum)) {
          return true
        }
      }
    }

    return false
  }

  return walk(0, 0) ? selection : null
}
