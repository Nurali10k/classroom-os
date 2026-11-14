import { useTheme } from '../../hooks/useTheme'

/**
 * Mounted once, above the router. Keeps `document.documentElement` and
 * `localStorage` in sync with `state.ui.theme` for the whole session.
 */
export default function ThemeProvider({ children }) {
  useTheme()
  return children
}
