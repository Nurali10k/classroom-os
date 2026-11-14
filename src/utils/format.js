/**
 * format.js
 * Tiny pure formatters shared by features. Kept separate from dateHelpers so
 * the date math stays free of presentation concerns.
 */

/** `'Computer Science'` → `'CS'`, `'Mathematics'` → `'MAT'`. */
export function subjectCode(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/** `'Aziza Karimova'` → `'AK'`. */
export function initials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export function formatBytes(bytes) {
  const value = Number(bytes)
  if (!value || value < 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const EXTENSION_KIND = {
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  rtf: 'document',
  ppt: 'slides',
  pptx: 'slides',
  key: 'slides',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  svg: 'image',
  mp4: 'video',
  mov: 'video',
}

export function fileExtension(fileName) {
  const parts = String(fileName ?? '').split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

export function fileKind(fileName) {
  return EXTENSION_KIND[fileExtension(fileName)] ?? 'file'
}

export function truncate(text, max = 96) {
  const value = String(text ?? '')
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

/** `'aziza.karimova@school.io'` → `'Aziza Karimova'` — fallback name for accounts without one. */
export function nameFromEmail(email) {
  const local = String(email ?? '').split('@')[0]
  if (!local) return 'Unnamed member'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}
