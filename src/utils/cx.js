/** Minimal className joiner. Accepts strings, arrays, and `{ class: boolean }` maps. */
export function cx(...parts) {
  const out = []

  for (const part of parts) {
    if (!part) continue

    if (typeof part === 'string' || typeof part === 'number') {
      out.push(part)
    } else if (Array.isArray(part)) {
      const nested = cx(...part)
      if (nested) out.push(nested)
    } else if (typeof part === 'object') {
      for (const key of Object.keys(part)) {
        if (part[key]) out.push(key)
      }
    }
  }

  return out.join(' ')
}

export default cx
