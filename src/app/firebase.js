/**
 * firebase.js
 * Firebase bootstrap. Firestore is initialised with persistent (IndexedDB)
 * local cache so the whole app keeps working offline and resumes writes when
 * the connection returns — a hard requirement for a school that loses Wi-Fi.
 */

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/**
 * The local demo backend can be selected explicitly with VITE_DEMO_MODE=true.
 * Otherwise valid Firebase config enables the live backend; without config
 * the app falls back to demo mode for local development.
 */
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)
export const isFirebaseConfigured = hasFirebaseConfig && env.VITE_DEMO_MODE !== 'true'

let app = null
let auth = null
let db = null
let storage = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)

  // Offline persistence — shared across tabs, backed by IndexedDB.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  storage = getStorage(app)
}

export { app, auth, db, storage }
