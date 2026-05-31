export const readStoredValue = (key, fallback) => {
  if (typeof localStorage === 'undefined') {
    return fallback
  }

  try {
    const rawValue = localStorage.getItem(key)
    return rawValue === null ? fallback : JSON.parse(rawValue)
  } catch {
    return fallback
  }
}

export const writeStoredValue = (key, value) => {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in private modes or locked-down browsers.
  }
}
