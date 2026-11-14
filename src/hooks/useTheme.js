import { useCallback, useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '../app/hooks'
import { selectTheme, setTheme, toggleTheme } from '../features/ui/uiSlice'
import { THEMES, THEME_STORAGE_KEY } from '../utils/constants'

const THEME_COLOR = {
  [THEMES.LIGHT]: '#FAFAFA',
  [THEMES.DARK]: '#0f172a',
}

/**
 * Mirrors a theme onto the document.
 *
 * The app never hard-codes a colour per component: Tailwind v4 emits
 * `var(--color-*)` for every token, so flipping `.dark` on <html> re-themes the
 * whole product. `color-scheme` is kept in step too so native controls
 * (scrollbars, form widgets, autofill) follow along.
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const isDark = theme === THEMES.DARK

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR[THEMES.LIGHT])
}

/**
 * Theme state lives in Redux (`state.ui.theme`) and in `localStorage`; the
 * `<html>` class is a derived side effect of this hook.
 *
 * @returns {{ theme: 'light'|'dark', isDark: boolean, setTheme: Function, toggleTheme: Function }}
 */
export function useTheme() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* private mode — the session still switches, it just will not persist */
    }
  }, [theme])

  const set = useCallback((next) => dispatch(setTheme(next)), [dispatch])
  const toggle = useCallback(() => dispatch(toggleTheme()), [dispatch])

  return { theme, isDark: theme === THEMES.DARK, setTheme: set, toggleTheme: toggle }
}

export default useTheme
