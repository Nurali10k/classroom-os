/**
 * constants.js
 * Domain vocabulary for Classroom OS. Every magic string lives here so the
 * Firestore schema, the RBAC guards and the UI all speak one language.
 */

export const APP_NAME = 'Classroom OS'
export const APP_TAGLINE = 'The operating surface for the class'

/* ------------------------------ Firestore ------------------------------ */

export const COLLECTIONS = {
  USERS: 'users',
  MEMBERS: 'members',
  CLASS_PROFILES: 'class_profiles',
  HOMEWORK: 'homework',
  HOMEWORK_PROGRESS: 'homework_progress',
  SUBJECTS: 'subjects',
  SCHEDULE: 'schedule',
  DUTY_ROSTER: 'duty_roster',
  ANNOUNCEMENTS: 'announcements',
  AUDIT_LOGS: 'audit_logs',
  /** Backing store for the shared resource library. */
  MATERIALS: 'materials',
  /** Per-user alert feed surfaced by the notification bell. */
  NOTIFICATIONS: 'notifications',
  /** Quick class votes. Admin-created, everybody votes once. */
  POLLS: 'polls',
  /** Private lesson notes, one document per member per lesson. */
  NOTES: 'notes',
}

/* ------------------------------- Theming ------------------------------- */

export const THEMES = { LIGHT: 'light', DARK: 'dark' }

/** Shared with the inline bootstrap script in index.html — keep in sync. */
export const THEME_STORAGE_KEY = 'classroom-os::theme'

/* ------------------------------ Languages ------------------------------ */

export const LANGUAGES = [
  { code: 'ru', short: 'RU', label: 'Русский' },
  { code: 'kg', short: 'KG', label: 'Кыргызча' },
  { code: 'en', short: 'EN', label: 'English' },
]

export const DEFAULT_LANGUAGE = 'ru'
export const LANGUAGE_STORAGE_KEY = 'classroom-os::language'

export const DEFAULT_PROFILE_PREFERENCES = {
  language: DEFAULT_LANGUAGE,
  theme: THEMES.LIGHT,
  compactSchedule: false,
  inAppNotifications: true,
  browserNotifications: false,
  notifyUrgentAnnouncements: true,
  notifyScheduleChanges: true,
  notifyNewHomework: true,
}

export const STUDENT_STATUSES = ['in_class', 'sick', 'exam_prep']

/* ---------------------------- Notifications ---------------------------- */

export const NOTIFICATION_TYPES = {
  HOMEWORK: 'hw_new',
  SCHEDULE: 'schedule_change',
  DUTY: 'duty',
}

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.HOMEWORK]: { tone: 'accent', icon: 'notebook' },
  [NOTIFICATION_TYPES.SCHEDULE]: { tone: 'warn', icon: 'calendar' },
  [NOTIFICATION_TYPES.DUTY]: { tone: 'success', icon: 'clipboard' },
}

/* -------------------------------- Roles -------------------------------- */

export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  HOMEWORK_MANAGER: 'homework_manager',
  CLEANER: 'cleaner',
  RESIDENT: 'resident',
}

/** Ascending authority. Used by the admin role selector and the HUD preview. */
export const ROLE_ORDER = [
  ROLES.RESIDENT,
  ROLES.CLEANER,
  ROLES.HOMEWORK_MANAGER,
  ROLES.TEACHER,
  ROLES.ADMIN,
]

export const ROLE_META = {
  [ROLES.RESIDENT]: {
    label: 'Resident',
    abbr: 'RES',
    authority: 1,
    summary: 'Read-only access to every board.',
    tone: 'neutral',
  },
  [ROLES.CLEANER]: {
    label: 'Duty Cleaner',
    abbr: 'CLN',
    authority: 2,
    summary: 'Resident rights + duty roster check-ins.',
    tone: 'accent',
  },
  [ROLES.HOMEWORK_MANAGER]: {
    label: 'Homework Manager',
    abbr: 'HWM',
    authority: 3,
    summary: 'Resident rights + full homework CRUD.',
    tone: 'accent',
  },
  [ROLES.TEACHER]: {
    label: 'Teacher',
    abbr: 'TCH',
    authority: 4,
    summary: 'Resident rights + global announcements CRUD.',
    tone: 'accent',
  },
  [ROLES.ADMIN]: {
    label: 'Administrator',
    abbr: 'ADM',
    authority: 5,
    summary: 'Unrestricted access, including the admin console.',
    tone: 'ink',
  },
}

/**
 * Capability map. `admin` is intentionally short-circuited inside `can()` so
 * new capabilities never need to repeat it.
 */
export const CAPABILITIES = {
  'homework:write': [ROLES.HOMEWORK_MANAGER],
  'announcements:write': [ROLES.TEACHER],
  'duty:check': [ROLES.CLEANER],
  'materials:upload': [ROLES.TEACHER, ROLES.HOMEWORK_MANAGER],
  /** Nobody but `admin` (short-circuited in `can()`) may open a poll. */
  'polls:create': [],
  'admin:access': [],
}

/** Single source of truth for every privilege check in the app. */
export function can(role, capability) {
  if (!role) return false
  if (role === ROLES.ADMIN) return true
  const allowed = CAPABILITIES[capability]
  return Array.isArray(allowed) ? allowed.includes(role) : false
}

/* ------------------------------- Schedule ------------------------------ */

/** dayOfWeek is 1 = Monday … 6 = Saturday. Sunday is intentionally absent. */
export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

/** Bell schedule. Lessons run 1 → 7. */
export const LESSON_SLOTS = [
  { lessonNumber: 1, start: '08:00', end: '08:45' },
  { lessonNumber: 2, start: '08:55', end: '09:40' },
  { lessonNumber: 3, start: '09:55', end: '10:40' },
  { lessonNumber: 4, start: '10:55', end: '11:40' },
  { lessonNumber: 5, start: '12:10', end: '12:55' },
  { lessonNumber: 6, start: '13:05', end: '13:50' },
  { lessonNumber: 7, start: '14:00', end: '14:45' },
]

/* ------------------------------ Announcements -------------------------- */

export const ANNOUNCEMENT_STATUS = {
  REGULAR: 'regular',
  PINNED: 'pinned',
  URGENT: 'urgent',
}

export const ANNOUNCEMENT_STATUS_META = {
  [ANNOUNCEMENT_STATUS.REGULAR]: { label: 'Regular', tone: 'neutral' },
  [ANNOUNCEMENT_STATUS.PINNED]: { label: 'Pinned', tone: 'accent' },
  [ANNOUNCEMENT_STATUS.URGENT]: { label: 'Urgent', tone: 'danger' },
}

export const ANNOUNCEMENT_STATUS_ORDER = [
  ANNOUNCEMENT_STATUS.URGENT,
  ANNOUNCEMENT_STATUS.PINNED,
  ANNOUNCEMENT_STATUS.REGULAR,
]

/* --------------------------------- Duty -------------------------------- */

/** Rotating duty slots. Each roster day is split into two assignments. */
export const DUTY_SLOTS = [
  { id: 'morning', label: 'Morning shift', window: '07:50 – 08:00' },
  { id: 'evening', label: 'Evening shift', window: '14:45 – 15:05' },
]

/* ------------------------------- Materials ----------------------------- */

export const MATERIAL_KINDS = {
  DOCUMENT: 'document',
  SLIDES: 'slides',
  SHEET: 'sheet',
  ARCHIVE: 'archive',
  LINK: 'link',
}

/* ------------------------------- Vacations ----------------------------- */

/** Breaks used by the countdown widgets. Dates are local ISO (YYYY-MM-DD). */
export const VACATIONS = [
  { id: 'autumn-1', name: 'Autumn Break', start: '2026-10-26', end: '2026-11-01' },
  { id: 'autumn-2', name: 'Autumn Break II', start: '2026-11-23', end: '2026-11-29' },
  { id: 'winter', name: 'Winter Break', start: '2026-12-28', end: '2027-01-10' },
  { id: 'spring', name: 'Spring Break', start: '2027-03-22', end: '2027-03-28' },
  { id: 'summer', name: 'Summer Break', start: '2027-06-01', end: '2027-08-31' },
]

/**
 * Anchor Monday of study week #1. Week parity (odd / even) is derived from
 * this date so every client agrees without extra Firestore reads.
 */
export const STUDY_WEEK_ANCHOR = '2026-09-07'

/* --------------------------------- Misc -------------------------------- */

export const TIMER_PRESETS = [
  { label: 'Focus', minutes: 25 },
  { label: 'Deep work', minutes: 45 },
  { label: 'Break', minutes: 5 },
]

export const AUDIT_ACTIONS = {
  ROLE_CHANGED: 'role.changed',
  NAME_RENAMED: 'profile.renamed',
  USER_DEACTIVATED: 'user.deactivated',
  USER_REACTIVATED: 'user.reactivated',
  ANNOUNCEMENT_PUBLISHED: 'announcement.published',
  ANNOUNCEMENT_UPDATED: 'announcement.updated',
  SUBJECT_UPDATED: 'subject.updated',
  RECORD_PURGED: 'record.purged',
  POLL_PUBLISHED: 'poll.published',
  POLL_CLOSED: 'poll.closed',
}

/* --------------------------------- Polls ------------------------------- */

/** A poll closes either when the admin ends it or when this many days pass. */
export const POLL_DEFAULT_TTL_DAYS = 3
