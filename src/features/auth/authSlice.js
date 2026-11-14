import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  user: null, // firebase auth record: { uid, email }
  profile: null, // users/{uid} document
  status: 'idle', // idle | loading | authenticated | anonymous
  error: null,
  ready: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionLoading(state) {
      state.status = 'loading'
      state.error = null
    },
    sessionReady(state, action) {
      const { user, profile } = action.payload ?? {}
      state.user = user ?? null
      state.profile = profile ?? null
      state.status = user ? 'authenticated' : 'anonymous'
      state.ready = true
      state.error = null
    },
    sessionFailed(state, action) {
      state.status = 'anonymous'
      state.ready = true
      state.error = action.payload ?? 'Authentication failed'
    },
    setProfile(state, action) {
      state.profile = action.payload
    },
    notify(message) {
      if (!message) return
      return undefined
    },
    signOutLocal(state) {
      state.user = null
      state.profile = null
      state.status = 'anonymous'
      state.error = null
    },
  },
})

export const {
  sessionLoading,
  sessionReady,
  sessionFailed,
  setProfile,
  signOutLocal,
} = authSlice.actions

export const selectAuth = (state) => state.auth
export const selectUser = (state) => state.auth.user
export const selectProfile = (state) => state.auth.profile
export const selectEffectiveRole = (state) => state.auth.profile?.role ?? null

export default authSlice.reducer

// `nanoid` is re-exported by RTK and available to feature slices that need ids.
export { nanoid }
