import { createSlice, nanoid } from '@reduxjs/toolkit'

import { THEMES, THEME_STORAGE_KEY } from '../../utils/constants'

/**
 * The inline bootstrap script in index.html already applied the stored theme
 * before the first paint — reading it back here just keeps Redux and the DOM
 * in agreement.
 */
function readStoredTheme() {
  if (typeof window === 'undefined') return THEMES.LIGHT
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === THEMES.DARK || stored === THEMES.LIGHT) return stored
  } catch {
    /* private mode — fall through to the system preference */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT
}

const initialState = {
  toasts: [],
  sidebarOpen: false,
  navCollapsed: false,
  /** 'light' | 'dark' — mirrored onto <html> by useTheme(). */
  theme: readStoredTheme(),
  /** Per-user alert feed, hydrated from Firestore by useNotifications(). */
  notifications: [],
  notificationsOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    pushToast: {
      reducer(state, action) {
        state.toasts.push(action.payload)
        // Keep the stack shallow — this is an OS, not a log file.
        if (state.toasts.length > 4) state.toasts.shift()
      },
      prepare({ title, description = '', tone = 'neutral', duration = 4200 }) {
        return { payload: { id: nanoid(8), title, description, tone, duration } }
      },
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload)
    },
    clearToasts(state) {
      state.toasts = []
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    setTheme(state, action) {
      state.theme = action.payload === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT
    },
    toggleTheme(state) {
      state.theme = state.theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    },
    setNotifications(state, action) {
      state.notifications = Array.isArray(action.payload) ? action.payload : []
    },
    setNotificationsOpen(state, action) {
      state.notificationsOpen = Boolean(action.payload)
    },
    markNotificationRead(state, action) {
      const target = state.notifications.find((item) => item.id === action.payload)
      if (target) target.read = true
    },
    markAllNotificationsRead(state) {
      state.notifications.forEach((item) => {
        item.read = true
      })
    },
  },
})

export const {
  pushToast,
  dismissToast,
  clearToasts,
  setSidebarOpen,
  toggleSidebar,
  setTheme,
  toggleTheme,
  setNotifications,
  setNotificationsOpen,
  markNotificationRead,
  markAllNotificationsRead,
} = uiSlice.actions

export const selectToasts = (state) => state.ui.toasts
export const selectSidebarOpen = (state) => state.ui.sidebarOpen
export const selectTheme = (state) => state.ui.theme
export const selectNotifications = (state) => state.ui.notifications
export const selectNotificationsOpen = (state) => state.ui.notificationsOpen
export const selectUnreadCount = (state) =>
  state.ui.notifications.reduce((total, item) => (item.read ? total : total + 1), 0)

export default uiSlice.reducer
