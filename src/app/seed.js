/**
 * Empty starter dataset for the offline demo backend.
 * User-created demo records are stored locally and are not cleared here.
 */

import { COLLECTIONS, DEFAULT_PROFILE_PREFERENCES, ROLES } from '../utils/constants'

export const DEMO_ADMIN_ACCOUNT = {
  uid: 'demo-admin',
  email: 'nurik1223334444@gmail.com',
  displayName: 'Nurik Admin',
  password: 'DemoAdmin123!',
  role: ROLES.ADMIN,
}

export const DEMO_ACCOUNTS = [DEMO_ADMIN_ACCOUNT]

const SEEDED_USER_IDS = new Set([
  'u-admin',
  'u-teacher-1',
  'u-teacher-2',
  'u-hwm',
  'u-clean-1',
  'u-clean-2',
  'u-res-1',
  'u-res-2',
  'u-res-3',
  'u-res-4',
  'u-res-5',
  'u-res-6',
  'u-res-7',
  'u-res-8',
  'u-res-9',
])

function seededDutyIds(seededOn) {
  if (!seededOn) return new Set()
  const day = new Date(`${seededOn}T00:00:00`)
  if (Number.isNaN(day.getTime())) return new Set()

  const ids = new Set()
  for (let offset = -7; offset <= 9; offset += 1) {
    const date = new Date(day)
    date.setDate(day.getDate() + offset)
    if (date.getDay() === 0) continue
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    ids.add(`duty-${isoDate}`)
  }
  return ids
}

/** Removes only the fixed sample records from a previously stored demo dataset. */
export function removeDemoSeedData(collections, seededOn) {
  const seededDutyRosterIds = seededDutyIds(seededOn)
  const seededIdsByCollection = {
    [COLLECTIONS.USERS]: SEEDED_USER_IDS,
    [COLLECTIONS.SUBJECTS]: new Set([
      'sub-math',
      'sub-physics',
      'sub-cs',
      'sub-chem',
      'sub-bio',
      'sub-eng',
      'sub-hist',
      'sub-lit',
      'sub-geo',
      'sub-pe',
    ]),
    [COLLECTIONS.SCHEDULE]: new Set([
      ...Array.from({ length: 6 }, (_, index) => index + 1).flatMap((day) =>
        Array.from({ length: 7 }, (_, index) => `sched-${day}-${index + 1}`),
      ),
    ]),
    [COLLECTIONS.HOMEWORK]: new Set(Array.from({ length: 8 }, (_, index) => `hw-${index + 1}`)),
    [COLLECTIONS.DUTY_ROSTER]: seededDutyRosterIds,
    [COLLECTIONS.ANNOUNCEMENTS]: new Set(
      Array.from({ length: 5 }, (_, index) => `ann-${index + 1}`),
    ),
    [COLLECTIONS.MATERIALS]: new Set(
      Array.from({ length: 7 }, (_, index) => `mat-${index + 1}`),
    ),
    [COLLECTIONS.AUDIT_LOGS]: new Set(
      Array.from({ length: 4 }, (_, index) => `log-${index + 1}`),
    ),
  }

  return Object.fromEntries(
    Object.entries(collections ?? {}).map(([collection, rows]) => [
      collection,
      (Array.isArray(rows) ? rows : []).filter(
        (row) => !seededIdsByCollection[collection]?.has(row.id),
      ),
    ]),
  )
}

export function createSeedData() {
  return {
    ...Object.fromEntries(
      Object.values(COLLECTIONS).map((collection) => [collection, []]),
    ),
    [COLLECTIONS.USERS]: [
      {
        id: DEMO_ADMIN_ACCOUNT.uid,
        uid: DEMO_ADMIN_ACCOUNT.uid,
        displayName: DEMO_ADMIN_ACCOUNT.displayName,
        email: DEMO_ADMIN_ACCOUNT.email,
        role: DEMO_ADMIN_ACCOUNT.role,
        dutyCount: 0,
        isActive: true,
        className: '',
        subgroup: '',
        telegramHandle: '',
        status: '',
        preferences: { ...DEFAULT_PROFILE_PREFERENCES },
        createdAt: new Date().toISOString(),
      },
    ],
    [COLLECTIONS.MEMBERS]: [
      {
        id: DEMO_ADMIN_ACCOUNT.uid,
        uid: DEMO_ADMIN_ACCOUNT.uid,
        displayName: DEMO_ADMIN_ACCOUNT.displayName,
        role: DEMO_ADMIN_ACCOUNT.role,
        dutyCount: 0,
        isActive: true,
      },
    ],
    [COLLECTIONS.CLASS_PROFILES]: [
      {
        id: DEMO_ADMIN_ACCOUNT.uid,
        uid: DEMO_ADMIN_ACCOUNT.uid,
        displayName: DEMO_ADMIN_ACCOUNT.displayName,
        isActive: true,
        className: '',
        subgroup: '',
        telegramHandle: '',
        status: '',
      },
    ],
  }
}
