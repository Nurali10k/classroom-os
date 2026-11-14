/**
 * backend.js
 * One facade over two implementations:
 *   • firebase — live Firestore + Auth (used as soon as env vars are present)
 *   • demo     — an in-memory, localStorage-backed clone of the same six
 *                collections, so the product can be reviewed offline.
 *
 * Both expose the identical API, therefore no feature component ever branches
 * on which one is active.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where as whereClause,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged as fbOnAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updatePassword,
} from 'firebase/auth'

import { auth as fbAuth, db as fbDb, isFirebaseConfigured } from './firebase'
import {
  createSeedData,
  DEMO_ACCOUNTS,
  DEMO_ADMIN_ACCOUNT,
  removeDemoSeedData,
} from './seed'
import { COLLECTIONS, DEFAULT_PROFILE_PREFERENCES, ROLES } from '../utils/constants'
import { nameFromEmail } from '../utils/format'
import { toISODate } from '../utils/dateHelpers'

/* ------------------------------ Query engine ---------------------------- */

const COMPARATORS = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
}

/** Normalises Firestore Timestamps / Dates to a comparable string. */
function comparable(value) {
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return value
}

function matchFilters(row, filters) {
  return filters.every(({ field, op = '==', value }) => {
    const comparator = COMPARATORS[op] ?? COMPARATORS['==']
    return comparator(comparable(row[field]), comparable(value))
  })
}

/**
 * Applied to both backends so ordering and paging behave identically.
 * @param {Array} rows
 * @param {{ filters?: Array, sort?: { field: string, dir?: 'asc'|'desc' }, limit?: number }} [options]
 */
export function applyQuery(rows, options = {}) {
  const { filters = [], sort, limit } = options
  let result = filters.length ? rows.filter((row) => matchFilters(row, filters)) : rows.slice()

  if (sort?.field) {
    const direction = sort.dir === 'desc' ? -1 : 1
    result.sort((a, b) => {
      const left = comparable(a[sort.field])
      const right = comparable(b[sort.field])
      if (left === right) return 0
      if (left == null) return 1
      if (right == null) return -1
      return left > right ? direction : -direction
    })
  }

  if (typeof limit === 'number') result = result.slice(0, limit)
  return result
}

function publicMemberFromProfile(profile) {
  return {
    id: profile.uid,
    uid: profile.uid,
    displayName: profile.displayName,
    role: profile.role,
    dutyCount: profile.dutyCount ?? 0,
    isActive: profile.isActive !== false,
  }
}

function classProfileFromProfile(profile) {
  return {
    id: profile.uid,
    uid: profile.uid,
    displayName: profile.displayName,
    isActive: profile.isActive !== false,
    className: profile.className ?? '',
    subgroup: profile.subgroup ?? '',
    telegramHandle: profile.telegramHandle ?? '',
    status: profile.status ?? '',
  }
}

/* -------------------------------- Demo tier ----------------------------- */

const DB_KEY = 'classroom-os::demo-db::v2'
const LEGACY_DB_KEY = 'classroom-os::demo-db::v1'
const SESSION_KEY = 'classroom-os::demo-session::v1'

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode — the demo simply stops persisting */
  }
}

function initialDemoState() {
  const today = toISODate(new Date())
  const stored = readJSON(DB_KEY, null)

  if (stored && stored.seededOn === today && stored.collections) {
    try {
      window.localStorage.removeItem(LEGACY_DB_KEY)
    } catch {
      /* storage unavailable */
    }
    return stored
  }

  const legacy = readJSON(LEGACY_DB_KEY, null)
  const collections =
    legacy?.seededOn === today && legacy.collections
      ? removeDemoSeedData(legacy.collections, legacy.seededOn)
      : createSeedData()
  const fresh = { seededOn: today, collections }
  writeJSON(DB_KEY, fresh)
  try {
    window.localStorage.removeItem(LEGACY_DB_KEY)
  } catch {
    /* storage unavailable */
  }
  return fresh
}

function createDemoBackend() {
  const state = initialDemoState()
  state.collections[COLLECTIONS.MEMBERS] = (state.collections[COLLECTIONS.USERS] ?? []).map(
    publicMemberFromProfile,
  )
  writeJSON(DB_KEY, state)
  const subscribers = new Map() // collection → Set<{ options, onNext, onError }>
  const authSubscribers = new Set()
  let sessionUid = readJSON(SESSION_KEY, null)
  let counter = 0

  const nextId = (prefix = 'doc') => {
    counter += 1
    return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
  }

  const rowsOf = (name) => {
    if (!Array.isArray(state.collections[name])) state.collections[name] = []
    return state.collections[name]
  }

  if (sessionUid && !rowsOf(COLLECTIONS.USERS).some((user) => user.uid === sessionUid)) {
    sessionUid = null
    writeJSON(SESSION_KEY, null)
  }

  const persist = () => writeJSON(DB_KEY, state)

  const emit = (name) => {
    const listeners = subscribers.get(name)
    if (!listeners?.size) return
    const rows = rowsOf(name)
    listeners.forEach((entry) => {
      try {
        entry.onNext(applyQuery(rows, entry.options))
      } catch (error) {
        entry.onError?.(error)
      }
    })
  }

  const currentDemoUser = () => {
    if (!sessionUid) return null
    const profile = rowsOf(COLLECTIONS.USERS).find((user) => user.uid === sessionUid)
    if (!profile) return null
    return { uid: profile.uid, email: profile.email }
  }

  const emitAuth = () => {
    const user = currentDemoUser()
    authSubscribers.forEach((listener) => listener(user))
  }

  const upsertUser = (email, displayName) => {
    const users = rowsOf(COLLECTIONS.USERS)
    const normalised = String(email).trim().toLowerCase()
    const existing = users.find((user) => String(user.email).toLowerCase() === normalised)
    if (existing) return existing

    const uid = nextId('u')
    const created = {
      id: uid,
      uid,
      displayName: displayName || nameFromEmail(normalised),
      email: normalised,
      role: ROLES.RESIDENT,
      dutyCount: 0,
      isActive: true,
      className: '',
      subgroup: '',
      telegramHandle: '',
      status: '',
      preferences: { ...DEFAULT_PROFILE_PREFERENCES },
      createdAt: new Date().toISOString(),
    }
    users.push(created)
    rowsOf(COLLECTIONS.MEMBERS).push(publicMemberFromProfile(created))
    rowsOf(COLLECTIONS.CLASS_PROFILES).push(classProfileFromProfile(created))
    persist()
    emit(COLLECTIONS.USERS)
    emit(COLLECTIONS.MEMBERS)
    emit(COLLECTIONS.CLASS_PROFILES)
    return created
  }

  return {
    mode: 'demo',
    quickAccounts: DEMO_ACCOUNTS,

    /** One-shot read. */
    async fetch(name, options) {
      return applyQuery(rowsOf(name), options)
    },

    /** Realtime read. Returns the unsubscribe function. */
    subscribe(name, options, onNext, onError) {
      const entry = { options, onNext, onError }
      if (!subscribers.has(name)) subscribers.set(name, new Set())
      subscribers.get(name).add(entry)

      // Emit on the next tick so loading states behave like a network call.
      const timer = window.setTimeout(() => onNext(applyQuery(rowsOf(name), options)), 0)

      return () => {
        window.clearTimeout(timer)
        subscribers.get(name)?.delete(entry)
      }
    },

    subscribeUserProfile(uid, onNext, onError) {
      return this.subscribe(
        COLLECTIONS.USERS,
        { filters: [{ field: 'uid', value: uid }] },
        (rows) => onNext(rows[0] ?? null),
        onError,
      )
    },

    async create(name, data) {
      const id = data.id ?? nextId(name.slice(0, 3))
      const record = { ...data, id }
      rowsOf(name).push(record)
      persist()
      emit(name)
      return id
    },

    async update(name, id, patch) {
      const rows = rowsOf(name)
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) throw new Error(`Record ${id} not found in ${name}`)
      rows[index] = { ...rows[index], ...patch }
      if (name === COLLECTIONS.USERS) {
        const memberRows = rowsOf(COLLECTIONS.MEMBERS)
        const memberIndex = memberRows.findIndex((member) => member.uid === rows[index].uid)
        const publicFields = Object.fromEntries(
          ['displayName', 'role', 'dutyCount', 'isActive']
            .filter((key) => patch[key] !== undefined)
            .map((key) => [key, patch[key]]),
        )
        if (memberIndex === -1) memberRows.push(publicMemberFromProfile(rows[index]))
        else memberRows[memberIndex] = { ...memberRows[memberIndex], ...publicFields }
        emit(COLLECTIONS.MEMBERS)
        const classProfiles = rowsOf(COLLECTIONS.CLASS_PROFILES)
        const classProfileIndex = classProfiles.findIndex((entry) => entry.uid === rows[index].uid)
        const classFields = Object.fromEntries(
          ['displayName', 'isActive', 'className', 'subgroup', 'telegramHandle', 'status']
            .filter((key) => patch[key] !== undefined)
            .map((key) => [key, patch[key]]),
        )
        if (classProfileIndex === -1) classProfiles.push(classProfileFromProfile(rows[index]))
        else classProfiles[classProfileIndex] = { ...classProfiles[classProfileIndex], ...classFields }
        emit(COLLECTIONS.CLASS_PROFILES)
      }
      persist()
      emit(name)
      return rows[index]
    },

    async updateDutyRoster(id, isCompleted, checkedByUid) {
      const roster = rowsOf(COLLECTIONS.DUTY_ROSTER).find((row) => row.id === id)
      if (!roster) throw new Error(`Duty record ${id} not found`)
      const next = {
        ...roster,
        isCompleted,
        checkedByUid: isCompleted ? checkedByUid : '',
        updatedAt: new Date().toISOString(),
      }
      const delta = isCompleted ? 1 : -1
      rowsOf(COLLECTIONS.DUTY_ROSTER)[
        rowsOf(COLLECTIONS.DUTY_ROSTER).findIndex((row) => row.id === id)
      ] = next

      for (const uid of roster.cleanerUids ?? []) {
        const user = rowsOf(COLLECTIONS.USERS).find((row) => row.uid === uid)
        const member = rowsOf(COLLECTIONS.MEMBERS).find((row) => row.uid === uid)
        if (!user || !member) continue
        const dutyCount = Math.max(0, (member.dutyCount ?? 0) + delta)
        user.dutyCount = dutyCount
        member.dutyCount = dutyCount
      }

      persist()
      emit(COLLECTIONS.DUTY_ROSTER)
      emit(COLLECTIONS.USERS)
      emit(COLLECTIONS.MEMBERS)
    },

    async remove(name, id) {
      const rows = rowsOf(name)
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) return
      rows.splice(index, 1)
      persist()
      emit(name)
    },

    async getById(name, id) {
      return rowsOf(name).find((row) => row.id === id) ?? null
    },

    async ensureProfile(sessionUser, displayName) {
      if (!sessionUser?.uid) return null
      const existing = rowsOf(COLLECTIONS.USERS).find((user) => user.uid === sessionUser.uid)
      if (existing) {
        if (displayName && existing.displayName !== displayName) {
          existing.displayName = displayName
          const member = rowsOf(COLLECTIONS.MEMBERS).find((row) => row.uid === existing.uid)
          if (member) member.displayName = displayName
          const classProfile = rowsOf(COLLECTIONS.CLASS_PROFILES).find((row) => row.uid === existing.uid)
          if (classProfile) classProfile.displayName = displayName
          emit(COLLECTIONS.USERS)
          emit(COLLECTIONS.MEMBERS)
          persist()
        }
        if (!rowsOf(COLLECTIONS.CLASS_PROFILES).some((row) => row.uid === existing.uid)) {
          rowsOf(COLLECTIONS.CLASS_PROFILES).push(classProfileFromProfile(existing))
          emit(COLLECTIONS.CLASS_PROFILES)
          persist()
        }
        return existing
      }
      return upsertUser(sessionUser.email ?? `${sessionUser.uid}@classroom.local`, displayName)
    },

    auth: {
      onAuthStateChanged(listener) {
        authSubscribers.add(listener)
        const timer = window.setTimeout(() => listener(currentDemoUser()), 0)
        return () => {
          window.clearTimeout(timer)
          authSubscribers.delete(listener)
        }
      },

      async signIn(email, password) {
        if (String(password ?? '').length < 4) {
          throw new Error('Password must be at least 4 characters.')
        }
        if (String(email).trim().toLowerCase() === DEMO_ADMIN_ACCOUNT.email) {
          if (password !== DEMO_ADMIN_ACCOUNT.password) {
            throw new Error('Demo administrator email or password is incorrect.')
          }
          const users = rowsOf(COLLECTIONS.USERS)
          let user = users.find((entry) => entry.uid === DEMO_ADMIN_ACCOUNT.uid)
          if (!user) {
            user = {
              id: DEMO_ADMIN_ACCOUNT.uid,
              uid: DEMO_ADMIN_ACCOUNT.uid,
              displayName: DEMO_ADMIN_ACCOUNT.displayName,
              email: DEMO_ADMIN_ACCOUNT.email,
              role: ROLES.ADMIN,
              dutyCount: 0,
              isActive: true,
              className: '',
              subgroup: '',
              telegramHandle: '',
              status: '',
              preferences: { ...DEFAULT_PROFILE_PREFERENCES },
              createdAt: new Date().toISOString(),
            }
            users.push(user)
          } else {
            user = { ...user, role: ROLES.ADMIN, isActive: true }
            users[users.findIndex((entry) => entry.uid === DEMO_ADMIN_ACCOUNT.uid)] = user
          }
          persist()
          emit(COLLECTIONS.USERS)
          sessionUid = user.uid
          writeJSON(SESSION_KEY, sessionUid)
          emitAuth()
          return { uid: user.uid, email: user.email }
        }
        const user = upsertUser(email)
        if (!user.isActive) throw new Error('This account has been deactivated by an administrator.')
        sessionUid = user.uid
        writeJSON(SESSION_KEY, sessionUid)
        emitAuth()
        return { uid: user.uid, email: user.email }
      },

      async signInWithGoogle() {
        throw new Error('Google sign-in requires Firebase configuration and an enabled Google provider.')
      },

      async signUp(email, password, displayName) {
        if (String(password ?? '').length < 6) {
          throw new Error('Password must be at least 6 characters.')
        }
        if (String(email).trim().toLowerCase() === DEMO_ADMIN_ACCOUNT.email) {
          throw new Error('The local demo administrator already exists. Sign in with the demo credentials.')
        }
        const user = upsertUser(email, displayName)
        sessionUid = user.uid
        writeJSON(SESSION_KEY, sessionUid)
        emitAuth()
        return { uid: user.uid, email: user.email }
      },

      async signOut() {
        sessionUid = null
        writeJSON(SESSION_KEY, null)
        emitAuth()
      },

      async changePassword() {
        throw new Error('Password changes are unavailable in demo mode.')
      },
    },
  }
}

/* ------------------------------ Firebase tier --------------------------- */

function buildConstraints(options = {}) {
  return (options.filters ?? [])
    .filter(({ value }) => value !== undefined)
    .map(({ field, op = '==', value }) => whereClause(field, op, value))
}

function createFirebaseBackend() {
  const auth = {
    onAuthStateChanged(listener) {
      return fbOnAuthStateChanged(fbAuth, (user) => {
        listener(
          user
            ? {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
              }
            : null,
        )
      })
    },

    async signIn(email, password) {
      const credential = await signInWithEmailAndPassword(fbAuth, email, password)
      return { uid: credential.user.uid, email: credential.user.email }
    },

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const credential = await signInWithPopup(fbAuth, provider)
      return {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        photoURL: credential.user.photoURL,
      }
    },

    async signUp(email, password, displayName) {
      const credential = await createUserWithEmailAndPassword(fbAuth, email, password)
      return { uid: credential.user.uid, email: credential.user.email, displayName }
    },

    async signOut() {
      await fbSignOut(fbAuth)
    },

    async changePassword(currentPassword, nextPassword) {
      const currentUser = fbAuth.currentUser
      if (!currentUser?.email) throw new Error('Your authentication session is unavailable.')
      if (!currentUser.providerData.some((provider) => provider.providerId === 'password')) {
        throw new Error('This account does not use password sign-in.')
      }

      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, nextPassword)
    },
  }

  /**
   * Guarantees a `users/{uid}` document exists for the signed-in account.
   * New sign-ups land on the lowest privilege tier by default.
   */
  async function ensureProfile(sessionUser, displayName) {
    if (!sessionUser?.uid) return null
    const ref = doc(fbDb, COLLECTIONS.USERS, sessionUser.uid)
    const memberRef = doc(fbDb, COLLECTIONS.MEMBERS, sessionUser.uid)
    const classProfileRef = doc(fbDb, COLLECTIONS.CLASS_PROFILES, sessionUser.uid)
    const [snapshot, memberSnapshot, classProfileSnapshot] = await Promise.all([
      getDoc(ref),
      getDoc(memberRef),
      getDoc(classProfileRef),
    ])
    if (snapshot.exists()) {
      const existing = { id: snapshot.id, ...snapshot.data() }
      const next = {
        ...existing,
        displayName: displayName || existing.displayName,
      }
      const batch = writeBatch(fbDb)
      let hasWrites = false
      if (displayName && existing.displayName !== displayName) {
        batch.update(ref, { displayName })
        hasWrites = true
      }
      const publicMember = publicMemberFromProfile(next)
      const classProfile = classProfileFromProfile(next)
      if (memberSnapshot.exists()) {
        if (displayName && memberSnapshot.data().displayName !== displayName) {
          batch.update(memberRef, { displayName })
          hasWrites = true
        }
      } else {
        batch.set(memberRef, publicMember)
        hasWrites = true
      }
      if (!classProfileSnapshot.exists()) {
        batch.set(classProfileRef, classProfile)
        hasWrites = true
      } else if (displayName && classProfileSnapshot.data().displayName !== displayName) {
        batch.update(classProfileRef, { displayName })
        hasWrites = true
      }
      if (hasWrites) await batch.commit()
      if (existing.role === ROLES.ADMIN) await syncPublicMemberDirectory()
      return next
    }

    const profile = {
      uid: sessionUser.uid,
      displayName: displayName || sessionUser.displayName || nameFromEmail(sessionUser.email),
      email: sessionUser.email ?? '',
      role: ROLES.RESIDENT,
      dutyCount: 0,
      isActive: true,
      className: '',
      subgroup: '',
      telegramHandle: '',
      status: '',
      preferences: { ...DEFAULT_PROFILE_PREFERENCES },
      createdAt: serverTimestamp(),
    }
    const batch = writeBatch(fbDb)
    batch.set(ref, profile)
    batch.set(memberRef, publicMemberFromProfile(profile))
    batch.set(classProfileRef, classProfileFromProfile(profile))
    await batch.commit()
    if (profile.role === ROLES.ADMIN) await syncPublicMemberDirectory()
    return { id: sessionUser.uid, ...profile }
  }

  async function syncPublicMemberDirectory() {
    const snapshot = await getDocs(collection(fbDb, COLLECTIONS.USERS))
    const batch = writeBatch(fbDb)
    snapshot.docs.forEach((entry) => {
      const profile = { uid: entry.id, ...entry.data() }
      batch.set(
        doc(fbDb, COLLECTIONS.MEMBERS, entry.id),
        publicMemberFromProfile(profile),
      )
      batch.set(
        doc(fbDb, COLLECTIONS.CLASS_PROFILES, entry.id),
        classProfileFromProfile(profile),
      )
    })
    if (!snapshot.empty) await batch.commit()
  }

  return {
    mode: 'firebase',
    quickAccounts: [],

    async fetch(name, options) {
      const snapshot = await getDocs(query(collection(fbDb, name), ...buildConstraints(options)))
      const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      return applyQuery(rows, options)
    },

    subscribe(name, options, onNext, onError) {
      const target = query(collection(fbDb, name), ...buildConstraints(options))
      return onSnapshot(
        target,
        (snapshot) => {
          const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
          onNext(applyQuery(rows, options))
        },
        (error) => onError?.(error),
      )
    },

    subscribeUserProfile(uid, onNext, onError) {
      return onSnapshot(
        doc(fbDb, COLLECTIONS.USERS, uid),
        (snapshot) => onNext(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
        onError,
      )
    },

    async create(name, data) {
      // The id is written into the payload so both backends can filter on it.
      const ref = doc(collection(fbDb, name))
      await setDoc(ref, { ...data, id: ref.id })
      return ref.id
    },

    async update(name, id, patch) {
      if (name !== COLLECTIONS.USERS) {
        await updateDoc(doc(fbDb, name, id), patch)
        return
      }

      const publicPatch = Object.fromEntries(
        ['displayName', 'role', 'dutyCount', 'isActive']
          .filter((key) => patch[key] !== undefined)
          .map((key) => [key, patch[key]]),
      )
      const classProfilePatch = Object.fromEntries(
        ['displayName', 'isActive', 'className', 'subgroup', 'telegramHandle', 'status']
          .filter((key) => patch[key] !== undefined)
          .map((key) => [key, patch[key]]),
      )
      const batch = writeBatch(fbDb)
      batch.update(doc(fbDb, COLLECTIONS.USERS, id), patch)
      if (Object.keys(publicPatch).length) {
        batch.set(doc(fbDb, COLLECTIONS.MEMBERS, id), { uid: id, ...publicPatch }, { merge: true })
      }
      if (Object.keys(classProfilePatch).length) {
        batch.set(
          doc(fbDb, COLLECTIONS.CLASS_PROFILES, id),
          { uid: id, ...classProfilePatch },
          { merge: true },
        )
      }
      await batch.commit()
    },

    async updateDutyRoster(id, isCompleted, checkedByUid) {
      const rosterRef = doc(fbDb, COLLECTIONS.DUTY_ROSTER, id)
      await runTransaction(fbDb, async (transaction) => {
        const rosterSnapshot = await transaction.get(rosterRef)
        if (!rosterSnapshot.exists()) throw new Error(`Duty record ${id} not found`)

        const roster = rosterSnapshot.data()
        if (roster.isCompleted === isCompleted) return

        const memberRefs = (roster.cleanerUids ?? []).map((uid) =>
          doc(fbDb, COLLECTIONS.MEMBERS, uid),
        )
        const memberSnapshots = await Promise.all(
          memberRefs.map((memberRef) => transaction.get(memberRef)),
        )

        transaction.update(rosterRef, {
          isCompleted,
          checkedByUid: isCompleted ? checkedByUid : '',
          updatedAt: new Date().toISOString(),
        })

        const delta = isCompleted ? 1 : -1
        memberSnapshots.forEach((memberSnapshot, index) => {
          if (!memberSnapshot.exists()) {
            throw new Error(`Member profile ${roster.cleanerUids[index]} is missing from the roster.`)
          }
          const uid = roster.cleanerUids[index]
          const nextCount = Math.max(0, (memberSnapshot.data().dutyCount ?? 0) + delta)
          transaction.update(doc(fbDb, COLLECTIONS.USERS, uid), {
            dutyCount: nextCount,
            lastDutyUpdateId: id,
          })
          transaction.update(memberRefs[index], { dutyCount: nextCount })
        })
      })
    },

    async remove(name, id) {
      await deleteDoc(doc(fbDb, name, id))
    },

    async getById(name, id) {
      const snapshot = await getDoc(doc(fbDb, name, id))
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
    },

    ensureProfile,
    auth,
  }
}

/* --------------------------------- Export ------------------------------- */

export const backend = isFirebaseConfigured ? createFirebaseBackend() : createDemoBackend()
export const isDemoMode = backend.mode === 'demo'
export { COLLECTIONS }
