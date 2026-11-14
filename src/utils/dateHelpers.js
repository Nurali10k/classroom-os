/**
 * dateHelpers.js
 * Pure date math. No React, no Firebase — trivially unit-testable.
 */

import { LESSON_SLOTS, STUDY_WEEK_ANCHOR, VACATIONS } from './constants'

const MS_MINUTE = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000
const LOCALE_TAGS = { en: 'en-US', ru: 'ru-RU', kg: 'ky-KG' }

function getLocale() {
  const language = typeof document === 'undefined' ? 'ru' : document.documentElement.lang
  return LOCALE_TAGS[language] ?? LOCALE_TAGS.ru
}

export const MILLISECONDS = { MS_MINUTE, MS_HOUR, MS_DAY }

/* ------------------------------- Parsing ------------------------------- */

/**
 * Local-midnight `Date` for a date string. Accepts both the short form
 * (`'2026-11-14'`) and a full ISO timestamp, so Firestore Timestamps and
 * `toISOString()` payloads resolve to the same calendar day without UTC drift.
 */
export function parseISODate(value) {
  if (!value) return null
  if (value instanceof Date) return startOfDay(value)

  const text = String(value)
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed)
}

export function toISODate(value) {
  const date = value instanceof Date ? value : parseISODate(value)
  if (!date) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : parseISODate(value)
  if (!date) return null
  date.setHours(0, 0, 0, 0)
  return date
}

export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'number') return new Date(value)
  return parseISODate(value)
}

/* ------------------------------ Arithmetic ----------------------------- */

/** Whole calendar days from `a` to `b`. Negative when `b` is in the past. */
export function diffInDays(a, b) {
  const from = startOfDay(toDate(a))
  const to = startOfDay(toDate(b))
  if (!from || !to) return 0
  return Math.round((to - from) / MS_DAY)
}

export function addDays(value, amount) {
  const date = startOfDay(toDate(value))
  if (!date) return null
  date.setDate(date.getDate() + amount)
  return date
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(value) {
  const date = toDate(value)
  if (!date) return 1
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/* -------------------------------- Time --------------------------------- */

/** `'08:45'` → minutes since midnight. */
export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(minutes) {
  const clamped = ((minutes % 1440) + 1440) % 1440
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

/** Minutes since midnight for "now", unless a reference date is supplied. */
export function minutesOfDay(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes()
}

/* ---------------------------- Lesson tracking -------------------------- */

/**
 * Where are we in the bell schedule right now?
 * Returns the current lesson, the next lesson, and a 0..100 completion ratio
 * for the current lesson so the UI can render an accurate progress bar.
 */
export function getLessonProgress(now = new Date()) {
  const current = minutesOfDay(now)
  let active = null
  let next = null

  for (let i = 0; i < LESSON_SLOTS.length; i += 1) {
    const slot = LESSON_SLOTS[i]
    const start = timeToMinutes(slot.start)
    const end = timeToMinutes(slot.end)

    if (current >= start && current < end) active = slot
    if (!next && current < start) next = slot
  }

  let progress = 0
  let remainingMs = 0

  if (active) {
    const start = timeToMinutes(active.start)
    const end = timeToMinutes(active.end)
    progress = Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100))
    remainingMs = (end - current) * MS_MINUTE
  } else if (next) {
    remainingMs = (timeToMinutes(next.start) - current) * MS_MINUTE
  }

  return { active, next, progress, remainingMs }
}

/* ------------------------------ Study week ----------------------------- */

/**
 * Study-week number + parity. Week #1 starts on the anchor Monday, so the
 * value flips every Monday at local midnight.
 */
export function getStudyWeek(reference = new Date()) {
  const date = startOfDay(reference)
  const anchor = startOfDay(STUDY_WEEK_ANCHOR)
  if (!date || !anchor) {
    return { number: 1, parity: 'odd', parityLabel: 'Odd week' }
  }

  // Shift to the Monday of the reference week, then count whole weeks.
  const weekday = isoWeekday(date)
  const monday = addDays(date, -(weekday - 1))
  const number = Math.floor(diffInDays(anchor, monday) / 7) + 1
  const parity = number % 2 === 0 ? 'even' : 'odd'

  return {
    number,
    parity,
    parityLabel: parity === 'odd' ? 'Odd week' : 'Even week',
    startsOn: toISODate(monday),
  }
}

/* ------------------------------- Vacations ----------------------------- */

export function isWithinVacation(vacation, reference = new Date()) {
  const day = startOfDay(reference)
  const start = startOfDay(vacation.start)
  const end = startOfDay(vacation.end)
  if (!day || !start || !end) return false
  return day >= start && day <= end
}

export function getActiveVacation(reference = new Date()) {
  return VACATIONS.find((vacation) => isWithinVacation(vacation, reference)) || null
}

/** Next break that has not finished yet, with a full countdown payload. */
export function getVacationCountdown(reference = new Date()) {
  const now = toDate(reference) || new Date()
  const day = startOfDay(now)

  const upcoming = VACATIONS
    .filter((vacation) => (startOfDay(vacation.end) || 0) >= day)
    .sort((a, b) => (startOfDay(a.start) - startOfDay(b.start)))[0]

  if (!upcoming) {
    return { vacation: null, isActive: false, target: null, totalMs: 0, days: 0, parts: null }
  }

  const isActive = isWithinVacation(upcoming, now)
  const target = isActive ? startOfDay(upcoming.end) : startOfDay(upcoming.start)
  const totalMs = Math.max(0, target - now)

  return {
    vacation: upcoming,
    isActive,
    target,
    totalMs,
    days: diffInDays(now, target),
    parts: splitDuration(totalMs),
  }
}

/* ------------------------------- Countdown ----------------------------- */

export function splitDuration(ms) {
  const total = Math.max(0, ms)
  return {
    days: Math.floor(total / MS_DAY),
    hours: Math.floor((total % MS_DAY) / MS_HOUR),
    minutes: Math.floor((total % MS_HOUR) / MS_MINUTE),
    seconds: Math.floor((total % MS_MINUTE) / 1000),
  }
}

/** Monospaced-safe `DD:HH:MM:SS` (always the same character count). */
export function formatCountdown(ms) {
  const { days, hours, minutes, seconds } = splitDuration(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatCountdownShort(ms) {
  const { days, hours, minutes } = splitDuration(ms)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/* ------------------------------ Formatting ----------------------------- */

/** Formats calendar dates using the language selected in the application. */
export function formatDate(value, { withYear = 'auto', withWeekday = false } = {}) {
  const date = toDate(value)
  if (!date) return '—'

  const now = new Date()
  const includeYear = withYear === true || (withYear === 'auto' && date.getFullYear() !== now.getFullYear())

  return new Intl.DateTimeFormat(getLocale(), {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    ...(withWeekday ? { weekday: 'long' } : {}),
  }).format(date)
}

export function formatTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Compact relative label used across homework and duty cards. */
export function formatRelative(value, reference = new Date(), t) {
  const date = toDate(value)
  if (!date) return '—'

  const days = diffInDays(reference, date)
  if (days === 0) return t ? t('date.today') : 'Today'
  if (days === 1) return t ? t('date.tomorrow') : 'Tomorrow'
  if (days === -1) return t ? t('date.yesterday') : 'Yesterday'

  if (days > 1 && days <= 13) return t ? t('common.inDays', { count: days }) : `In ${days} days`
  if (days < -1 && days >= -13) return t ? t('common.daysAgo', { count: Math.abs(days) }) : `${Math.abs(days)} days ago`

  return formatDate(date)
}

export function isOverdue(deadline, reference = new Date()) {
  const date = toDate(deadline)
  if (!date) return false
  const endOfDay = startOfDay(date)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay < (reference instanceof Date ? reference : new Date())
}

export function isDueSoon(deadline, withinDays = 2, reference = new Date()) {
  const date = toDate(deadline)
  if (!date) return false
  const days = diffInDays(reference, date)
  return days >= 0 && days <= withinDays
}

/** Monday of the week containing `reference`, as an ISO date string. */
export function startOfWeekISO(reference = new Date()) {
  const date = addDays(reference, -(isoWeekday(reference) - 1))
  return toISODate(date)
}

/** `'2026-11-09'` → `'09.11'` — used in the compact schedule header. */
export function formatDayStamp(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}

export function greet(reference = new Date(), t) {
  const hour = (reference instanceof Date ? reference : new Date()).getHours()
  const key = hour < 5
    ? 'dashboard.greetLate'
    : hour < 12
      ? 'dashboard.greetMorning'
      : hour < 18
        ? 'dashboard.greetAfternoon'
        : 'dashboard.greetEvening'
  if (t) return t(key)
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
