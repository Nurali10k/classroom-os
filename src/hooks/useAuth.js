import { useContext } from 'react'
import { AuthContext } from '../context/AuthContextValue'

/**
 * Session + capability access for every component.
 *
 * `useAuth()` gives you the persisted role used by route guards and capabilities.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth() must be used inside <AuthProvider>')
  return context
}

export default useAuth
