import { useCallback, useMemo } from 'react'
import { useAppDispatch } from '../app/hooks'
import { dismissToast, pushToast } from '../features/ui/uiSlice'

/**
 * Imperative notification API.
 * @returns {{ notify: Function, success: Function, error: Function, info: Function, warning: Function, loading: Function, dismiss: Function, clear: Function }}
 */
export function useToast() {
  const dispatch = useAppDispatch()

  const notify = useCallback((options) => dispatch(pushToast(options)), [dispatch])
  const success = useCallback((title, description) => dispatch(pushToast({ title, description, tone: 'success' })), [dispatch])
  const error = useCallback(
    (title, description) => dispatch(pushToast({ title, description, tone: 'error', duration: 6000 })),
    [dispatch],
  )
  const info = useCallback((title, description) => dispatch(pushToast({ title, description, tone: 'info' })), [dispatch])
  const warning = useCallback(
    (title, description) => dispatch(pushToast({ title, description, tone: 'warning', duration: 5200 })),
    [dispatch],
  )
  const loading = useCallback(
    (title, description) => dispatch(pushToast({ title, description, tone: 'loading', duration: 0 })),
    [dispatch],
  )
  const dismiss = useCallback((id) => dispatch(dismissToast(id)), [dispatch])

  return useMemo(
    () => ({ notify, success, error, info, warning, loading, dismiss }),
    [notify, success, error, info, warning, loading, dismiss],
  )
}

export default useToast
