/**
 * fuzzy.js
 * Dependency-free fuzzy matcher for the admin user grid.
 * Scores subsequence matches and rewards word-boundary hits so that
 * "atv" ranks "Alisher Tursunov" above unrelated rows.
 */

const BOUNDARY = /[\s.\-_/]/

/**
 * @returns {number} score (higher is better) or -1 when there is no match.
 */
export function fuzzyScore(query, text) {
  const needle = String(query ?? '').trim().toLowerCase()
  const haystack = String(text ?? '').toLowerCase()

  if (!needle) return 0
  if (!haystack) return -1

  // Fast path: contiguous substring.
  const direct = haystack.indexOf(needle)
  if (direct !== -1) {
    const boundaryBonus = direct === 0 || BOUNDARY.test(haystack[direct - 1]) ? 6 : 0
    return 100 - direct + boundaryBonus
  }

  let score = 0
  let haystackIndex = 0
  let previousMatch = -1

  for (let i = 0; i < needle.length; i += 1) {
    const char = needle[i]
    const found = haystack.indexOf(char, haystackIndex)
    if (found === -1) return -1

    score += 4

    if (previousMatch === found - 1) score += 3 // consecutive run
    if (found === 0 || BOUNDARY.test(haystack[found - 1])) score += 5 // word start
    score -= Math.min(4, found - previousMatch) // penalise long gaps

    previousMatch = found
    haystackIndex = found + 1
  }

  return score
}

/**
 * Filter + rank a collection across several fields.
 * `keys` may hold dotted paths (`'profile.city'`).
 */
export function fuzzyFilter(items, query, keys, { limit } = {}) {
  const list = Array.isArray(items) ? items : []
  if (!String(query ?? '').trim()) return limit ? list.slice(0, limit) : list

  const scored = []

  for (const item of list) {
    let best = -1
    for (const key of keys) {
      const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), item)
      if (value == null) continue
      const score = fuzzyScore(query, value)
      if (score > best) best = score
    }
    if (best >= 0) scored.push({ item, score: best })
  }

  scored.sort((a, b) => b.score - a.score)
  const ranked = scored.map((entry) => entry.item)
  return limit ? ranked.slice(0, limit) : ranked
}

/** Highlight helper: splits `text` into matched / unmatched runs. */
export function fuzzySegments(query, text) {
  const needle = String(query ?? '').trim().toLowerCase()
  const source = String(text ?? '')
  if (!needle) return [{ text: source, match: false }]

  const segments = []
  let cursor = 0
  let sourceIndex = 0

  for (let i = 0; i < needle.length; i += 1) {
    const found = source.toLowerCase().indexOf(needle[i], sourceIndex)
    if (found === -1) break
    if (found > cursor) segments.push({ text: source.slice(cursor, found), match: false })
    segments.push({ text: source.slice(found, found + 1), match: true })
    cursor = found + 1
    sourceIndex = found + 1
  }

  if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false })
  return segments
}
