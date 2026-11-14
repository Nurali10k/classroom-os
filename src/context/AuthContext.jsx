import { useCallback, useEffect, useMemo } from 'react'

import { backend, isDemoMode } from '../app/backend'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { AuthContext } from './AuthContextValue'
import { useTheme } from '../hooks/useTheme'
import { setLanguage } from '../i18n/config'
import {
  selectEffectiveRole,
  sessionFailed,
  sessionLoading,
  sessionReady,
  setProfile,
  signOutLocal,
} from '../features/auth/authSlice'
import { COLLECTIONS, LANGUAGES, ROLES, THEMES, can } from '../utils/constants'

/**
 * Owns the session lifecycle:
 *  1. subscribes to the auth provider (Firebase Auth, or the demo session),
 *  2. guarantees a matching `users/{uid}` profile document,
 *  3. keeps that profile live via a Firestore snapshot,
 *  4. exposes capability helpers derived from the persisted role.
 */
export function AuthProvider({ children }) {
  const dispatch = useAppDispatch()
  const { setTheme } = useTheme()

  const user = useAppSelector((state) => state.auth.user)
  const profile = useAppSelector((state) => state.auth.profile)
  const status = useAppSelector((state) => state.auth.status)
  const ready = useAppSelector((state) => state.auth.ready)
  const error = useAppSelector((state) => state.auth.error)
  const effectiveRole = useAppSelector(selectEffectiveRole)

  const uid = user?.uid ?? null
  const profileUid = profile?.uid
  const preferences = profile?.preferences

  useEffect(() => {
    if (!ready || !profileUid) return
    if (LANGUAGES.some((language) => language.code === preferences?.language)) {
      setLanguage(preferences.language)
    }
    if (Object.values(THEMES).includes(preferences?.theme)) {
      setTheme(preferences.theme)
    }
  }, [ready, profileUid, preferences?.language, preferences?.theme, setTheme])

  /* ----------------------------- Session ----------------------------- */
  useEffect(() => {
    let active = true
    dispatch(sessionLoading())

    const unsubscribe = backend.auth.onAuthStateChanged(async (sessionUser) => {
      if (!active) return

      if (!sessionUser) {
        dispatch(sessionReady({ user: null, profile: null }))
        return
      }

      try {
        const nextProfile = await backend.ensureProfile(sessionUser)
        if (!active) return
        dispatch(sessionReady({ user: sessionUser, profile: nextProfile }))
      } catch (cause) {
        if (!active) return
        dispatch(sessionFailed(cause?.message ?? 'Could not load the member profile.'))
      }
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [dispatch])

  /* ------------------------- Live profile sync ------------------------ */
  useEffect(() => {
    if (!uid) return undefined

    return backend.subscribeUserProfile(uid, (nextProfile) => {
      if (nextProfile) dispatch(setProfile(nextProfile))
    })
  }, [uid, dispatch])

  /* ----------------------------- Actions ----------------------------- */
  const signIn = useCallback(
    async (email, password) => {
      dispatch(sessionLoading())
      try {
        await backend.auth.signIn(email, password)
      } catch (cause) {
        dispatch(sessionFailed(cause?.message ?? 'Sign-in failed.'))
        throw cause
      }
    },
    [dispatch],
  )

  const signUp = useCallback(
    async (email, password, displayName) => {
      dispatch(sessionLoading())
      try {
        const created = await backend.auth.signUp(email, password, displayName)
        await backend.ensureProfile(created, displayName)
      } catch (cause) {
        dispatch(sessionFailed(cause?.message ?? 'Registration failed.'))
        throw cause
      }
    },
    [dispatch],
  )

  const signInWithGoogle = useCallback(async () => {
    dispatch(sessionLoading())
    try {
      await backend.auth.signInWithGoogle()
    } catch (cause) {
      dispatch(sessionFailed(cause?.message ?? 'Google sign-in failed.'))
      throw cause
    }
  }, [dispatch])

  const updateProfile = useCallback(
    async (changes) => {
      if (!uid || !profile) throw new Error('Your profile is not ready yet.')

      const requested = typeof changes === 'string' ? { displayName: changes } : changes
      const patch = {}
      if (requested?.displayName !== undefined) {
        const nextName = String(requested.displayName ?? '').trim()
        if (nextName.length < 2 || nextName.length > 80) {
          throw new Error('Name must be between 2 and 80 characters.')
        }
        patch.displayName = nextName
      }
      if (requested?.telegramHandle !== undefined) {
        const handle = String(requested.telegramHandle ?? '').trim().replace(/^@/, '')
        if (handle && !/^[a-zA-Z0-9_]{5,32}$/.test(handle)) {
          throw new Error('Telegram username must be 5–32 letters, numbers, or underscores.')
        }
        patch.telegramHandle = handle
      }
      if (requested?.status !== undefined) {
        patch.status = String(requested.status ?? '')
      }
      if (requested?.preferences !== undefined) {
        patch.preferences = { ...profile.preferences, ...requested.preferences }
      }
      if (Object.keys(patch).length === 0) return

      const updatedAt = new Date().toISOString()
      await backend.update(COLLECTIONS.USERS, profile.id ?? uid, { ...patch, updatedAt })
      dispatch(setProfile({ ...profile, ...patch, updatedAt }))
    },
    [dispatch, profile, uid],
  )

  const changePassword = useCallback(
    async (currentPassword, nextPassword) => {
      if (!user) throw new Error('Your authentication session is unavailable.')
      await backend.auth.changePassword(currentPassword, nextPassword)
    },
    [user],
  )

  const signOut = useCallback(async () => {
    try {
      await backend.auth.signOut()
    } finally {
      dispatch(signOutLocal())
    }
  }, [dispatch])

  const value = useMemo(
    () => ({
      user,
      profile,
      status,
      ready,
      error,
      isDemoMode,
      isAuthenticated: Boolean(user),

      /** Real, persisted authority. */
      role: profile?.role ?? null,
      isAdmin: profile?.role === ROLES.ADMIN,

      /** Persisted authority used by route guards and capability checks. */
      effectiveRole,

      can: (capability) => can(effectiveRole, capability),
      is: (...roles) => roles.includes(effectiveRole),

      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      changePassword,
    }),
    [
      user,
      profile,
      status,
      ready,
      error,
      effectiveRole,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      changePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
